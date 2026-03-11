import asyncio
import uuid
import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from supabase import Client
from postgrest.exceptions import APIError as PostgRESTError
from database import get_db
from schemas import NoteCreate, NoteRead, NoteUpdate, NoteListItem
from services import gemini
from services import vector as vs
from config import get_settings

router = APIRouter(prefix="/notes", tags=["notes"])

_NOTE_SELECT = "id, title, content, created_at, updated_at, user_id, note_tags(tag_id, tags(id, name))"


def _get_user_id(request: Request) -> str | None:
    """Extract user_id from the Supabase JWT in the Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[len("Bearer "):]
    try:
        # Decode without verifying signature — Supabase middleware already validated it.
        # We only need the `sub` claim (user UUID).
        payload = pyjwt.decode(token, options={"verify_signature": False})
        return payload.get("sub")
    except Exception:
        return None


def _normalize_note(raw: dict) -> dict:
    """Flatten nested note_tags -> tags(id, name) into a flat tags list."""
    raw_tags = raw.pop("note_tags", []) or []
    tags = [nt["tags"] for nt in raw_tags if nt and nt.get("tags")]
    raw["tags"] = tags
    return raw


async def _fetch_note_or_404(db: Client, note_id: uuid.UUID, user_id: str | None = None) -> dict:
    """Fetch a single note with tags. Raises 404 if not found or not owned by user.
    Notes with no owner (user_id IS NULL) are accessible to all authenticated users."""
    try:
        q = db.table("notes").select(_NOTE_SELECT).eq("id", str(note_id))
        if user_id:
            # Allow access if note belongs to this user OR note has no owner
            q = q.or_(f"user_id.eq.{user_id},user_id.is.null")
        result = await asyncio.to_thread(lambda: q.single().execute())
        return _normalize_note(result.data)
    except PostgRESTError as e:
        if "PGRST116" in str(e):
            raise HTTPException(status_code=404, detail="Note not found")
        raise


async def _embed_and_link(note_id: uuid.UUID, content: str, title: str) -> None:
    """Background task: generate embedding and recompute knowledge-graph edges."""
    text_to_embed = f"{title}\n{content}"
    embedding = await gemini.embed_text(text_to_embed)
    await vs.upsert_embedding(note_id, embedding)
    await vs.recompute_links_for_note(note_id)


@router.get("", response_model=list[NoteListItem])
async def list_notes(request: Request, db: Client = Depends(get_db)):
    user_id = _get_user_id(request)
    q = db.table("notes").select(_NOTE_SELECT).order("updated_at", desc=True)
    if user_id:
        # Return notes owned by this user OR notes with no owner (legacy/dev notes)
        q = q.or_(f"user_id.eq.{user_id},user_id.is.null")
    result = await asyncio.to_thread(lambda: q.execute())
    rows = result.data or []
    return [_normalize_note(r) for r in rows]


@router.post("", response_model=NoteRead, status_code=201)
async def create_note(
    request: Request,
    body: NoteCreate,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_db),
):
    user_id = _get_user_id(request)
    payload: dict = {"title": body.title, "content": body.content}
    if user_id:
        payload["user_id"] = user_id

    result = await asyncio.to_thread(
        lambda: db.table("notes").insert(payload).execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create note")
    note_id = uuid.UUID(result.data[0]["id"])
    note_data = await _fetch_note_or_404(db, note_id, user_id)
    background_tasks.add_task(_embed_and_link, note_id, body.content, body.title)
    return note_data


@router.get("/{note_id}", response_model=NoteRead)
async def get_note(note_id: uuid.UUID, request: Request, db: Client = Depends(get_db)):
    user_id = _get_user_id(request)
    return await _fetch_note_or_404(db, note_id, user_id)


@router.put("/{note_id}", response_model=NoteRead)
async def update_note(
    note_id: uuid.UUID,
    body: NoteUpdate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_db),
):
    user_id = _get_user_id(request)
    await _fetch_note_or_404(db, note_id, user_id)

    updates: dict = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.content is not None:
        updates["content"] = body.content

    if updates:
        q = db.table("notes").update(updates).eq("id", str(note_id))
        if user_id:
            q = q.eq("user_id", user_id)
        await asyncio.to_thread(lambda: q.execute())

    note_data = await _fetch_note_or_404(db, note_id, user_id)
    background_tasks.add_task(
        _embed_and_link,
        note_id,
        note_data.get("content", ""),
        note_data.get("title", ""),
    )
    return note_data


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: uuid.UUID, request: Request, db: Client = Depends(get_db)):
    user_id = _get_user_id(request)
    await _fetch_note_or_404(db, note_id, user_id)
    q = db.table("notes").delete().eq("id", str(note_id))
    if user_id:
        q = q.eq("user_id", user_id)
    await asyncio.to_thread(lambda: q.execute())


@router.post("/{note_id}/tags/{tag_name}", response_model=NoteRead)
async def add_tag(note_id: uuid.UUID, tag_name: str, request: Request, db: Client = Depends(get_db)):
    user_id = _get_user_id(request)
    await _fetch_note_or_404(db, note_id, user_id)

    tag_result = await asyncio.to_thread(
        lambda: db.table("tags").select("id, name").eq("name", tag_name).execute()
    )
    if tag_result.data:
        tag_id = tag_result.data[0]["id"]
    else:
        new_tag = await asyncio.to_thread(
            lambda: db.table("tags").insert({"name": tag_name}).execute()
        )
        tag_id = new_tag.data[0]["id"]

    existing = await asyncio.to_thread(
        lambda: db.table("note_tags")
        .select("note_id")
        .eq("note_id", str(note_id))
        .eq("tag_id", tag_id)
        .execute()
    )
    if not existing.data:
        await asyncio.to_thread(
            lambda: db.table("note_tags")
            .insert({"note_id": str(note_id), "tag_id": tag_id})
            .execute()
        )

    return await _fetch_note_or_404(db, note_id, user_id)


@router.delete("/{note_id}/tags/{tag_name}", response_model=NoteRead)
async def remove_tag(note_id: uuid.UUID, tag_name: str, request: Request, db: Client = Depends(get_db)):
    user_id = _get_user_id(request)
    await _fetch_note_or_404(db, note_id, user_id)

    tag_result = await asyncio.to_thread(
        lambda: db.table("tags").select("id").eq("name", tag_name).execute()
    )
    if not tag_result.data:
        raise HTTPException(status_code=404, detail="Tag not found")
    tag_id = tag_result.data[0]["id"]

    await asyncio.to_thread(
        lambda: db.table("note_tags")
        .delete()
        .eq("note_id", str(note_id))
        .eq("tag_id", tag_id)
        .execute()
    )

    return await _fetch_note_or_404(db, note_id, user_id)

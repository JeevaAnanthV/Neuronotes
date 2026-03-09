import asyncio
import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from supabase import Client
from postgrest.exceptions import APIError as PostgRESTError
from database import get_db
from schemas import NoteCreate, NoteRead, NoteUpdate, NoteListItem
from services import gemini
from services import vector as vs

router = APIRouter(prefix="/notes", tags=["notes"])

_NOTE_SELECT = "id, title, content, created_at, updated_at, note_tags(tag_id, tags(id, name))"


def _normalize_note(raw: dict) -> dict:
    """Flatten nested note_tags -> tags(id, name) into a flat tags list."""
    raw_tags = raw.pop("note_tags", []) or []
    tags = [nt["tags"] for nt in raw_tags if nt and nt.get("tags")]
    raw["tags"] = tags
    return raw


async def _fetch_note_or_404(db: Client, note_id: uuid.UUID) -> dict:
    """Fetch a single note with tags. Raises 404 if not found."""
    try:
        result = await asyncio.to_thread(
            lambda: db.table("notes").select(_NOTE_SELECT).eq("id", str(note_id)).single().execute()
        )
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


@router.get("/", response_model=list[NoteListItem])
async def list_notes(db: Client = Depends(get_db)):
    result = await asyncio.to_thread(
        lambda: db.table("notes")
        .select(_NOTE_SELECT)
        .order("updated_at", desc=True)
        .execute()
    )
    rows = result.data or []
    return [_normalize_note(r) for r in rows]


@router.post("/", response_model=NoteRead, status_code=201)
async def create_note(
    body: NoteCreate,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_db),
):
    result = await asyncio.to_thread(
        lambda: db.table("notes")
        .insert({"title": body.title, "content": body.content})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create note")
    note_id = uuid.UUID(result.data[0]["id"])
    note_data = await _fetch_note_or_404(db, note_id)
    background_tasks.add_task(_embed_and_link, note_id, body.content, body.title)
    return note_data


@router.get("/{note_id}", response_model=NoteRead)
async def get_note(note_id: uuid.UUID, db: Client = Depends(get_db)):
    return await _fetch_note_or_404(db, note_id)


@router.put("/{note_id}", response_model=NoteRead)
async def update_note(
    note_id: uuid.UUID,
    body: NoteUpdate,
    background_tasks: BackgroundTasks,
    db: Client = Depends(get_db),
):
    # Verify note exists first
    await _fetch_note_or_404(db, note_id)

    updates: dict = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.content is not None:
        updates["content"] = body.content

    if updates:
        await asyncio.to_thread(
            lambda: db.table("notes").update(updates).eq("id", str(note_id)).execute()
        )

    note_data = await _fetch_note_or_404(db, note_id)
    background_tasks.add_task(
        _embed_and_link,
        note_id,
        note_data.get("content", ""),
        note_data.get("title", ""),
    )
    return note_data


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: uuid.UUID, db: Client = Depends(get_db)):
    # Raises 404 if not found
    await _fetch_note_or_404(db, note_id)
    await asyncio.to_thread(
        lambda: db.table("notes").delete().eq("id", str(note_id)).execute()
    )


@router.post("/{note_id}/tags/{tag_name}", response_model=NoteRead)
async def add_tag(note_id: uuid.UUID, tag_name: str, db: Client = Depends(get_db)):
    # Verify note exists
    await _fetch_note_or_404(db, note_id)

    # Get or create tag
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

    # Link tag to note (skip if already linked)
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

    return await _fetch_note_or_404(db, note_id)


@router.delete("/{note_id}/tags/{tag_name}", response_model=NoteRead)
async def remove_tag(note_id: uuid.UUID, tag_name: str, db: Client = Depends(get_db)):
    """Remove a tag from a note. The tag itself is preserved if used by other notes."""
    await _fetch_note_or_404(db, note_id)

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

    return await _fetch_note_or_404(db, note_id)

import asyncio
import re
import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Header
from supabase import Client
from postgrest.exceptions import APIError as PostgRESTError
from database import get_db
from config import get_settings
from typing import Optional

router = APIRouter(prefix="/rooms", tags=["rooms"])


def _slug_from_name(name: str) -> str:
    """Convert a room name to a URL-safe slug."""
    slug = re.sub(r"[^a-zA-Z0-9\s-]", "", name.lower())
    slug = re.sub(r"\s+", "-", slug.strip())
    slug = re.sub(r"-+", "-", slug)
    return slug[:60] or "room"


def _ensure_unique_slug(db: Client, base_slug: str) -> str:
    """Append numeric suffix if slug already exists."""
    slug = base_slug
    i = 2
    while True:
        result = db.table("rooms").select("id").eq("slug", slug).execute()
        if not (result.data or []):
            return slug
        slug = f"{base_slug}-{i}"
        i += 1


def _resolve_user_id(
    x_user_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> str:
    """
    Resolve the caller's user ID from:
    1. X-User-Id header (legacy / simple path)
    2. Authorization: Bearer <supabase_jwt> — decode without verification
       (Supabase already validates the JWT at the API gateway level;
       we just need the sub claim to know who the user is).
    Returns 'anonymous' if neither is present.
    """
    if x_user_id:
        return x_user_id
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        try:
            # decode without signature verification — trust Supabase middleware
            payload = pyjwt.decode(token, options={"verify_signature": False})
            return payload.get("sub") or "anonymous"
        except Exception:
            pass
    return "anonymous"


@router.post("", status_code=201)
async def create_room(
    body: dict,
    db: Client = Depends(get_db),
    x_user_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Create a new room. Owner resolved from X-User-Id or Authorization JWT."""
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Room name is required.")
    owner_id = _resolve_user_id(x_user_id, authorization)

    base_slug = _slug_from_name(name)
    slug = await asyncio.to_thread(lambda: _ensure_unique_slug(db, base_slug))

    result = await asyncio.to_thread(
        lambda: db.table("rooms").insert({"name": name, "slug": slug, "owner_id": owner_id}).execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create room.")
    room = result.data[0]

    # Auto-add owner as a member
    await asyncio.to_thread(
        lambda: db.table("room_members").insert({"room_id": room["id"], "user_id": owner_id}).execute()
    )

    return room


@router.get("")
async def list_rooms(
    db: Client = Depends(get_db),
    x_user_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """List all rooms the current user belongs to."""
    user_id = _resolve_user_id(x_user_id, authorization)
    memberships = await asyncio.to_thread(
        lambda: db.table("room_members").select("room_id").eq("user_id", user_id).execute()
    )
    room_ids = [m["room_id"] for m in (memberships.data or [])]
    if not room_ids:
        return []

    rooms_result = await asyncio.to_thread(
        lambda: db.table("rooms").select("*").in_("id", room_ids).order("created_at", desc=True).execute()
    )
    rooms = rooms_result.data or []

    # Attach member counts
    for room in rooms:
        mc = await asyncio.to_thread(
            lambda r=room: db.table("room_members").select("user_id").eq("room_id", r["id"]).execute()
        )
        room["member_count"] = len(mc.data or [])

    return rooms


@router.get("/{slug}")
async def get_room(slug: str, db: Client = Depends(get_db)):
    """Get a room by its slug (public — used for invite links)."""
    try:
        result = await asyncio.to_thread(
            lambda: db.table("rooms").select("*").eq("slug", slug).single().execute()
        )
        return result.data
    except PostgRESTError as e:
        if "PGRST116" in str(e):
            raise HTTPException(status_code=404, detail="Room not found.")
        raise


@router.post("/{slug}/join", status_code=200)
async def join_room(
    slug: str,
    db: Client = Depends(get_db),
    x_user_id: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    """Add current user as a member of the room."""
    user_id = _resolve_user_id(x_user_id, authorization)

    # Fetch room id
    try:
        room_result = await asyncio.to_thread(
            lambda: db.table("rooms").select("id, name, slug").eq("slug", slug).single().execute()
        )
    except PostgRESTError as e:
        if "PGRST116" in str(e):
            raise HTTPException(status_code=404, detail="Room not found.")
        raise
    room = room_result.data

    # Check already a member
    existing = await asyncio.to_thread(
        lambda: db.table("room_members")
        .select("user_id")
        .eq("room_id", room["id"])
        .eq("user_id", user_id)
        .execute()
    )
    if not (existing.data or []):
        await asyncio.to_thread(
            lambda: db.table("room_members").insert({"room_id": room["id"], "user_id": user_id}).execute()
        )

    return {"joined": True, "room": room}


@router.get("/{slug}/notes")
async def list_room_notes(slug: str, db: Client = Depends(get_db)):
    """List all notes in a room."""
    try:
        room_result = await asyncio.to_thread(
            lambda: db.table("rooms").select("id").eq("slug", slug).single().execute()
        )
    except PostgRESTError as e:
        if "PGRST116" in str(e):
            raise HTTPException(status_code=404, detail="Room not found.")
        raise
    room_id = room_result.data["id"]

    room_notes = await asyncio.to_thread(
        lambda: db.table("room_notes").select("note_id").eq("room_id", room_id).execute()
    )
    note_ids = [rn["note_id"] for rn in (room_notes.data or [])]
    if not note_ids:
        return []

    notes_result = await asyncio.to_thread(
        lambda: db.table("notes").select("id, title, content, created_at, updated_at").in_("id", note_ids).order("updated_at", desc=True).execute()
    )
    return notes_result.data or []


@router.post("/{slug}/notes", status_code=201)
async def add_note_to_room(slug: str, body: dict, db: Client = Depends(get_db)):
    """Add a note to a room."""
    note_id = body.get("note_id")
    if not note_id:
        raise HTTPException(status_code=400, detail="note_id is required.")

    try:
        room_result = await asyncio.to_thread(
            lambda: db.table("rooms").select("id").eq("slug", slug).single().execute()
        )
    except PostgRESTError as e:
        if "PGRST116" in str(e):
            raise HTTPException(status_code=404, detail="Room not found.")
        raise
    room_id = room_result.data["id"]

    # Skip if already added
    existing = await asyncio.to_thread(
        lambda: db.table("room_notes")
        .select("note_id")
        .eq("room_id", room_id)
        .eq("note_id", note_id)
        .execute()
    )
    if not (existing.data or []):
        await asyncio.to_thread(
            lambda: db.table("room_notes").insert({"room_id": room_id, "note_id": note_id}).execute()
        )

    return {"added": True}


@router.delete("/{slug}/notes/{note_id}", status_code=200)
async def remove_note_from_room(slug: str, note_id: str, db: Client = Depends(get_db)):
    """Remove a note from a room."""
    try:
        room_result = await asyncio.to_thread(
            lambda: db.table("rooms").select("id").eq("slug", slug).single().execute()
        )
    except PostgRESTError as e:
        if "PGRST116" in str(e):
            raise HTTPException(status_code=404, detail="Room not found.")
        raise
    room_id = room_result.data["id"]

    await asyncio.to_thread(
        lambda: db.table("room_notes")
        .delete()
        .eq("room_id", room_id)
        .eq("note_id", note_id)
        .execute()
    )
    return {"removed": True}


@router.get("/{slug}/members")
async def list_room_members(slug: str, db: Client = Depends(get_db)):
    """List all members of a room."""
    try:
        room_result = await asyncio.to_thread(
            lambda: db.table("rooms").select("id").eq("slug", slug).single().execute()
        )
    except PostgRESTError as e:
        if "PGRST116" in str(e):
            raise HTTPException(status_code=404, detail="Room not found.")
        raise
    room_id = room_result.data["id"]

    members_result = await asyncio.to_thread(
        lambda: db.table("room_members").select("user_id, joined_at").eq("room_id", room_id).execute()
    )
    return members_result.data or []

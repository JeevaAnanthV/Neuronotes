import asyncio
from fastapi import APIRouter, Depends
from supabase import Client
from database import get_db
from schemas import TagWithCount

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagWithCount])
async def list_tags(db: Client = Depends(get_db)):
    """Return all tags with their note counts, sorted by count descending."""
    # Fetch all tags with their associated note_tags rows
    result = await asyncio.to_thread(
        lambda: db.table("tags")
        .select("id, name, note_tags(note_id)")
        .execute()
    )
    rows = result.data or []

    tags = []
    for row in rows:
        note_tags = row.get("note_tags") or []
        tags.append(TagWithCount(
            id=row["id"],
            name=row["name"],
            note_count=len(note_tags),
        ))

    # Sort by note_count descending
    tags.sort(key=lambda t: t.note_count, reverse=True)
    return tags

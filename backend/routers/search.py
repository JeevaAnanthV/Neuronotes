import asyncio
import uuid
from fastapi import APIRouter, Depends, Query
from supabase import Client
from database import get_db
from schemas import SearchResult, NoteListItem
from services import gemini
from services import vector as vs

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/", response_model=list[SearchResult])
async def semantic_search(
    q: str = Query(..., min_length=1),
    top_k: int = Query(default=8, ge=1, le=20),
    db: Client = Depends(get_db),
):
    query_embedding = await gemini.embed_text(q)
    hits = await vs.similarity_search(query_embedding, top_k=top_k)

    if not hits:
        return []

    hit_ids = [str(note_id) for note_id, _ in hits]
    score_map = {str(note_id): score for note_id, score in hits}

    notes_result = await asyncio.to_thread(
        lambda: db.table("notes")
        .select("id, title, content, created_at, updated_at, note_tags(tag_id, tags(id, name))")
        .in_("id", hit_ids)
        .execute()
    )
    raw_notes = notes_result.data or []

    # Normalize tags and build id map
    def _normalize(raw: dict) -> dict:
        raw_tags = raw.pop("note_tags", []) or []
        raw["tags"] = [nt["tags"] for nt in raw_tags if nt and nt.get("tags")]
        return raw

    notes_by_id = {n["id"]: _normalize(n) for n in raw_notes}

    results = []
    for note_id, score in hits:
        note = notes_by_id.get(str(note_id))
        if note:
            results.append(SearchResult(note=NoteListItem(**note), score=score))
    return results

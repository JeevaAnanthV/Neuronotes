import asyncio
import uuid
import logging
from services import gemini

logger = logging.getLogger(__name__)


def _fmt_embedding(embedding: list[float]) -> list[float]:
    """Pass through the embedding list (supabase-py handles vector serialization)."""
    return embedding


async def upsert_embedding(note_id: uuid.UUID, embedding: list[float]) -> None:
    """Store/update the embedding for a note via Supabase RPC."""
    if not embedding:
        return
    from database import get_db
    db = get_db()
    await asyncio.to_thread(
        lambda: db.rpc("upsert_note_embedding", {
            "note_id": str(note_id),
            "embedding_vector": embedding,
        }).execute()
    )


async def similarity_search(
    query_embedding: list[float],
    top_k: int = 5,
    threshold: float = 0.4,
    exclude_id: uuid.UUID | None = None,
) -> list[tuple[uuid.UUID, float]]:
    """Return list of (note_id, similarity_score) sorted by cosine similarity."""
    from database import get_db
    db = get_db()
    result = await asyncio.to_thread(
        lambda: db.rpc("similarity_search", {
            "query_embedding": query_embedding,
            "match_count": top_k + (1 if exclude_id else 0),
            "match_threshold": threshold,
        }).execute()
    )
    rows = result.data or []
    out = []
    for row in rows:
        rid = uuid.UUID(row["id"])
        if exclude_id and rid == exclude_id:
            continue
        out.append((rid, float(row["score"])))
        if len(out) >= top_k:
            break
    return out


async def recompute_all_links(threshold: float = 0.75) -> int:
    """Recompute pairwise cosine similarities and update note_links table."""
    from database import get_db
    db = get_db()
    result = await asyncio.to_thread(
        lambda: db.rpc("recompute_note_links", {"threshold": threshold}).execute()
    )
    return result.data or 0


async def recompute_links_for_note(note_id: uuid.UUID, threshold: float = 0.75) -> None:
    """Upsert knowledge-graph edges for a single note against all others."""
    from database import get_db
    db = get_db()
    await asyncio.to_thread(
        lambda: db.rpc("recompute_links_for_note", {
            "p_note_id": str(note_id),
            "p_threshold": threshold,
        }).execute()
    )

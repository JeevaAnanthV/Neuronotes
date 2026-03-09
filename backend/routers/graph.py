import asyncio
from fastapi import APIRouter, Depends
from supabase import Client
from database import get_db
from schemas import GraphData, GraphNode, GraphEdge
from services.vector import recompute_all_links

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/", response_model=GraphData)
async def get_graph(db: Client = Depends(get_db)):
    notes_result = await asyncio.to_thread(
        lambda: db.table("notes")
        .select("id, title, note_tags(tag_id, tags(id, name))")
        .execute()
    )
    notes_raw = notes_result.data or []

    links_result = await asyncio.to_thread(
        lambda: db.table("note_links").select("source_id, target_id, similarity").execute()
    )
    links_raw = links_result.data or []

    nodes = []
    for n in notes_raw:
        raw_tags = n.pop("note_tags", []) or []
        tag_names = [nt["tags"]["name"] for nt in raw_tags if nt and nt.get("tags")]
        nodes.append(GraphNode(id=str(n["id"]), title=n["title"], tags=tag_names))

    edges = [
        GraphEdge(
            source=str(l["source_id"]),
            target=str(l["target_id"]),
            similarity=float(l["similarity"]),
        )
        for l in links_raw
    ]
    return GraphData(nodes=nodes, edges=edges)


@router.post("/recompute", status_code=200)
async def recompute_graph(threshold: float = 0.72):
    count = await recompute_all_links(threshold=threshold)
    return {"links_created": count}

# Dataflow: Knowledge Graph

This document traces how the knowledge graph is built from note embeddings, stored as database edges, and rendered as an interactive React Flow visualization.

## Table of Contents
- [Overview Diagram](#overview-diagram)
- [Graph Building](#graph-building)
- [Graph Serving](#graph-serving)
- [Frontend Rendering](#frontend-rendering)
- [Incremental vs Full Rebuild](#incremental-vs-full-rebuild)
- [Code References](#code-references)

---

## Overview Diagram

```
Notes saved (with embeddings)
        │
        ▼
[Background] recompute_links_for_note(note_id, threshold=0.75)
        │
        ├─ DELETE FROM note_links WHERE source_id=:id OR target_id=:id
        │
        └─ INSERT INTO note_links (source_id, target_id, similarity)
           SELECT a.id, b.id, 1-(a.embedding<=>b.embedding)
           FROM notes a, notes b
           WHERE a.id < b.id           ← prevents duplicate pairs
             AND (a.id=:id OR b.id=:id)
             AND similarity >= 0.75
        │
        ▼
note_links table:
  ┌──────────────┬──────────────┬────────────┐
  │  source_id   │  target_id   │ similarity │
  ├──────────────┼──────────────┼────────────┤
  │  uuid-A      │  uuid-B      │   0.89     │
  │  uuid-A      │  uuid-C      │   0.76     │
  │  uuid-B      │  uuid-D      │   0.82     │
  └──────────────┴──────────────┴────────────┘
        │
        ▼ (when user opens /graph)
[Frontend] graphApi.get() → GET /graph/
        │
        ▼
[Backend] get_graph handler
        │
        ├─ SELECT * FROM notes           → GraphNode[]
        └─ SELECT * FROM note_links      → GraphEdge[]
        │
        ▼
[Frontend] KnowledgeGraph component
        │
        ├─ buildNodes(data, filterTag)
        │       ├─ circular layout (radius = max(220, count * 55))
        │       ├─ node style: tagged notes get indigo border
        │       └─ edge style: opacity + strokeWidth scale with similarity
        │
        └─ <ReactFlow nodes={rfNodes} edges={rfEdges}>
                ├─ onNodeClick → router.push("/notes/{id}")
                ├─ onNodeMouseEnter → glow effect + tooltip
                ├─ Controls (zoom in/out/fit)
                └─ MiniMap
```

---

## Graph Building

### Trigger: background task on note save

Every time a note is created or updated, `_embed_and_link` runs as a background task after the HTTP response is sent. This calls `recompute_links_for_note`:

```python
# backend/services/vector.py:57-83
async def recompute_links_for_note(db, note_id, threshold=0.75):
    # Step 1: Remove all existing edges for this note
    await db.execute(
        text("DELETE FROM note_links WHERE source_id = :id OR target_id = :id"),
        {"id": str(note_id)},
    )
    # Step 2: Insert new edges above threshold
    await db.execute(text("""
        INSERT INTO note_links (source_id, target_id, similarity)
        SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding) AS sim
        FROM notes a, notes b
        WHERE a.id < b.id
          AND a.embedding IS NOT NULL
          AND b.embedding IS NOT NULL
          AND (a.id = :id OR b.id = :id)
          AND 1 - (a.embedding <=> b.embedding) >= :threshold
        ON CONFLICT (source_id, target_id) DO UPDATE
          SET similarity = EXCLUDED.similarity
    """), {"id": str(note_id), "threshold": threshold})
    await db.commit()
```

The `a.id < b.id` constraint is the key to preventing duplicate directed edges. Since both `(A,B)` and `(B,A)` would represent the same undirected connection, only the pair where the source UUID sorts before the target UUID is stored. The graph is visually bidirectional (React Flow uses arrow markers) but stored as a canonical unordered pair.

### Trigger: manual full rebuild

`POST /graph/recompute?threshold=0.72` triggers a full pairwise rebuild:

```python
# backend/services/vector.py:38-54
async def recompute_all_links(db, threshold=0.75):
    await db.execute(text("DELETE FROM note_links"))
    await db.execute(text("""
        INSERT INTO note_links (source_id, target_id, similarity)
        SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding) AS sim
        FROM notes a, notes b
        WHERE a.id < b.id
          AND a.embedding IS NOT NULL
          AND b.embedding IS NOT NULL
          AND 1 - (a.embedding <=> b.embedding) >= :threshold
    """), {"threshold": threshold})
    await db.commit()
    result = await db.execute(text("SELECT COUNT(*) FROM note_links"))
    return result.scalar() or 0
```

This is O(n²) over all embedded notes. For 100 notes: ~5000 pairs evaluated. For 1000 notes: ~500,000 pairs. Performance is adequate up to a few thousand notes using the IVFFlat index; for larger scale, consider chunked computation.

### Similarity thresholds

| Context | Threshold | Notes |
|---------|-----------|-------|
| Background per-note recompute | 0.75 | Hardcoded in `recompute_links_for_note` |
| Full rebuild default | 0.75 | Default parameter in `recompute_all_links` |
| Frontend-triggered full rebuild | 0.72 | `graphApi.recompute(0.72)` |
| Settings page rebuild | 0.72 | `graphApi.recompute(0.72)` |

The slight difference (0.75 vs 0.72) means the full rebuild produces slightly more edges (lower threshold = more connections). This is intentional — the manual rebuild is used to "fill in" connections that were missed when the threshold was higher.

---

## Graph Serving

`GET /graph/` fetches all notes and links:

```python
# backend/routers/graph.py:12-36
@router.get("/", response_model=GraphData)
async def get_graph(db: AsyncSession = Depends(get_db)):
    notes_result = await db.execute(select(Note))
    notes = notes_result.scalars().all()

    links_result = await db.execute(select(NoteLink))
    links = links_result.scalars().all()

    nodes = [GraphNode(id=str(n.id), title=n.title, tags=[t.name for t in n.tags]) for n in notes]
    edges = [GraphEdge(source=str(l.source_id), target=str(l.target_id), similarity=l.similarity) for l in links]
    return GraphData(nodes=nodes, edges=edges)
```

**Note:** This endpoint does two full table scans (`SELECT * FROM notes`, `SELECT * FROM note_links`). For large knowledge bases, consider adding pagination or a graph-specific materialized view.

The response:
```json
{
  "nodes": [
    {"id": "uuid-A", "title": "Machine Learning", "tags": ["ml", "ai"]},
    {"id": "uuid-B", "title": "Neural Networks", "tags": ["ml", "deep-learning"]}
  ],
  "edges": [
    {"source": "uuid-A", "target": "uuid-B", "similarity": 0.89}
  ]
}
```

---

## Frontend Rendering

### Layout algorithm

Nodes are arranged in a circle using a simple angular distribution:

```typescript
// frontend/components/KnowledgeGraph.tsx:34-61
const radius = Math.max(220, count * 55);
const rfNodes = filteredNodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / count;
    return {
        id: n.id,
        position: {
            x: 450 + radius * Math.cos(angle),
            y: 320 + radius * Math.sin(angle),
        },
        // ...
    };
});
```

The radius scales with the number of nodes: 55px per node, minimum 220px. This prevents overlap for small graphs and scales reasonably for medium ones.

### Edge visual encoding

Edge appearance encodes semantic similarity:
```typescript
// frontend/components/KnowledgeGraph.tsx:63-78
{
    animated: e.similarity > 0.87,          // animated (flowing) for very high similarity
    style: {
        stroke: `rgba(99, 102, 241, ${Math.min(0.8, e.similarity * 0.9)})`,  // opacity
        strokeWidth: Math.max(1, e.similarity * 3),                           // thickness
    },
    label: e.similarity > 0.9 ? `${(e.similarity * 100).toFixed(0)}%` : undefined,  // % label
}
```

- **Animated**: similarity > 87% (React Flow's `animated` prop creates a flowing dash effect)
- **Opacity**: scales 0.27 to 0.8 with similarity
- **Width**: scales 1px to 3px with similarity
- **Label**: similarity percentage shown only for > 90% connections

### Node visual encoding

Tagged notes have an indigo border; untagged notes have a dark gray border:
```typescript
border: `1px solid ${n.tags.length > 0 ? "rgba(99,102,241,0.45)" : "#2a2a2a"}`
```

### Interactivity

| Interaction | Behavior |
|-------------|---------|
| Hover over node | Purple glow effect + tooltip (title + tags + "Click to open note") |
| Click node | Navigate to `/notes/{id}` |
| Search box | Dims non-matching nodes (opacity 0.25), highlights matches |
| Tag filter | Shows only nodes with the selected tag; hides edges to excluded nodes |
| Refresh button | Re-fetches `GET /graph/` |
| Rebuild button | Calls `POST /graph/recompute`, then re-fetches |
| Reset button | Clears search and filter |

---

## Incremental vs Full Rebuild

| Method | Trigger | Scope | Complexity | When to use |
|--------|---------|-------|-----------|-------------|
| `recompute_links_for_note` | Note save (background) | Single note against all others | O(n) | Automatic, every save |
| `recompute_all_links` | `POST /graph/recompute` | All notes against all others | O(n²) | After bulk import or when graph is stale |

The incremental approach means the graph stays up-to-date incrementally without expensive full scans after every save. The full rebuild is a maintenance operation available from the graph page and settings page.

---

## Code References

| File | Lines | What |
|------|-------|------|
| `backend/services/vector.py` | 38–54 | `recompute_all_links` |
| `backend/services/vector.py` | 57–83 | `recompute_links_for_note` |
| `backend/routers/graph.py` | 12–42 | `get_graph` and `recompute_graph` endpoints |
| `frontend/components/KnowledgeGraph.tsx` | 27–81 | `buildNodes` — layout and visual encoding |
| `frontend/components/KnowledgeGraph.tsx` | 83–465 | `KnowledgeGraph` component — full implementation |

---

## Related Documents

- [Architecture: Database](../architecture/database.md)
- [Architecture: AI](../architecture/ai.md)
- [Features: Knowledge Graph](../features/knowledge-graph.md)
- [API Reference: Graph](../api/graph.md)

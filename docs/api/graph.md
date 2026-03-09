# API Reference: Graph

Knowledge graph endpoints for fetching graph data and triggering recomputation.

**Base path:** `/graph`

---

## Get Graph

```
GET /graph/
```

Returns all notes as nodes and all knowledge graph edges with similarity scores.

### Response

```
HTTP 200 OK
Content-Type: application/json
```

```json
{
  "nodes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Machine Learning Fundamentals",
      "tags": ["ml", "ai"]
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Neural Networks Deep Dive",
      "tags": ["deep-learning", "ml"]
    }
  ],
  "edges": [
    {
      "source": "550e8400-e29b-41d4-a716-446655440000",
      "target": "660e8400-e29b-41d4-a716-446655440001",
      "similarity": 0.892
    }
  ]
}
```

### Notes

- **Nodes include all notes** — even those without embeddings (no edges for those)
- **Edges are unordered pairs** — `source_id < target_id` in the database (lowest UUID alphabetically is source); the visual graph treats them as bidirectional
- **Empty graph**: Returns `{"nodes": [], "edges": []}` when there are no notes
- **No edges**: A note without embeddings has nodes but no edges

### Schema: GraphData

```json
{
  "nodes": [GraphNode],
  "edges": [GraphEdge]
}
```

### Schema: GraphNode

```json
{
  "id": "string (UUID)",
  "title": "string",
  "tags": ["string", ...]
}
```

Note: `tags` is a list of tag name strings (not `TagRead` objects with ids).

### Schema: GraphEdge

```json
{
  "source": "string (UUID)",
  "target": "string (UUID)",
  "similarity": "float (0.0 to 1.0)"
}
```

### Example

```bash
curl http://localhost:8000/graph/
```

---

## Recompute Graph

```
POST /graph/recompute
```

Deletes all existing `note_links` rows and recomputes pairwise cosine similarities for all notes with embeddings. Only pairs above the threshold are stored.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `threshold` | float | No | `0.72` | Minimum similarity score to create an edge (0.0 to 1.0) |

### Response

```
HTTP 200 OK
Content-Type: application/json
```

```json
{
  "links_created": 47
}
```

`links_created` is the total number of edges in the `note_links` table after recomputation.

### Notes

- **Destructive**: All existing edges are deleted before recomputation
- **Blocking**: This endpoint does not use background tasks — it runs synchronously. For large note collections, this may take a few seconds
- **Notes without embeddings are skipped**: Only notes with non-null embeddings participate in graph computation
- **Threshold effect**: Lower threshold = more edges. The default 0.72 produces a moderately connected graph

### Example

```bash
# Use default threshold (0.72)
curl -X POST http://localhost:8000/graph/recompute

# Use custom threshold for a denser graph
curl -X POST "http://localhost:8000/graph/recompute?threshold=0.6"

# Use higher threshold for a sparser graph
curl -X POST "http://localhost:8000/graph/recompute?threshold=0.85"
```

---

## Related Documents

- [API Overview](overview.md)
- [Dataflow: Knowledge Graph](../dataflow/knowledge-graph.md)
- [Features: Knowledge Graph](../features/knowledge-graph.md)
- [Architecture: Database](../architecture/database.md)

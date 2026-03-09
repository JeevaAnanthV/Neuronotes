# API Reference: Search

Semantic search endpoint using pgvector cosine similarity.

**Base path:** `/search`

---

## Semantic Search

```
GET /search/
```

Embeds the query using Gemini `text-embedding-004` and finds the most semantically similar notes using pgvector cosine similarity.

### Query Parameters

| Parameter | Type | Required | Default | Constraints |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | — | min length 1 |
| `top_k` | integer | No | 8 | min 1, max 20 |

### Response

```
HTTP 200 OK
Content-Type: application/json
```

```json
[
  {
    "note": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Machine Learning Fundamentals",
      "created_at": "2026-03-01T08:00:00Z",
      "updated_at": "2026-03-09T10:00:00Z",
      "tags": [{"id": "...", "name": "ml"}]
    },
    "score": 0.892
  },
  {
    "note": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Neural Networks Deep Dive",
      "created_at": "2026-03-02T09:00:00Z",
      "updated_at": "2026-03-08T14:30:00Z",
      "tags": [{"id": "...", "name": "deep-learning"}]
    },
    "score": 0.847
  }
]
```

Results are ordered by `score` descending (highest similarity first).

### Score interpretation

| Score | Meaning |
|-------|---------|
| 0.90 – 1.00 | Very high similarity |
| 0.75 – 0.90 | High similarity |
| 0.60 – 0.75 | Moderate similarity |
| 0.40 – 0.60 | Weak similarity |
| < 0.40 | Low similarity |

### Notes without embeddings

Notes that have not yet been processed by the background embedding task (newly created) are excluded from search results (`WHERE embedding IS NOT NULL`).

### Empty results

Returns an empty array `[]` if no notes have embeddings or no notes exist.

### Examples

```bash
# Basic semantic search
curl "http://localhost:8000/search/?q=machine+learning"

# With custom top_k
curl "http://localhost:8000/search/?q=productivity+techniques&top_k=5"

# URL-encoded query
curl "http://localhost:8000/search/?q=how%20does%20the%20brain%20work&top_k=10"
```

### Schema: SearchResult

```json
{
  "note": "NoteListItem",
  "score": "float (0.0 to 1.0)"
}
```

`NoteListItem` contains `id`, `title`, `created_at`, `updated_at`, `tags`. Does not include `content` or `embedding`.

---

## Related Documents

- [API Overview](overview.md)
- [Dataflow: Semantic Search](../dataflow/semantic-search.md)
- [Features: Search](../features/search.md)
- [Architecture: AI](../architecture/ai.md)

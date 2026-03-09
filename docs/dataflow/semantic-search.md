# Dataflow: Semantic Search

This document traces the complete path of data when a user performs a semantic search, from typing a query to receiving ranked results.

## Table of Contents
- [Overview Diagram](#overview-diagram)
- [Step-by-Step Flow](#step-by-step-flow)
- [Scoring and Ranking](#scoring-and-ranking)
- [Search Entry Points](#search-entry-points)
- [Code References](#code-references)

---

## Overview Diagram

```
User types query in Command Palette
        │
        ▼
[Frontend] 300ms debounce timer fires
        │
        ▼
[Frontend] searchApi.semantic(query, 8)
        │  GET /search/?q=...&top_k=8
        ▼
[Backend] semantic_search handler
        │
        ├─ query_embedding = await gemini.embed_text(q)
        │       └─ asyncio.to_thread(genai.embed_content)
        │       └─ returns [0.021, -0.034, ...] (768 floats)
        │
        ├─ hits = await vs.similarity_search(db, query_embedding, top_k=8)
        │       └─ SELECT id, 1-(embedding<=>:emb::vector) AS score
        │          FROM notes WHERE embedding IS NOT NULL
        │          ORDER BY embedding <=> :emb::vector
        │          LIMIT 8
        │       └─ returns [(note_id, 0.89), (note_id, 0.82), ...]
        │
        ├─ hit_ids = [note_id for note_id, _ in hits]
        ├─ notes_result = SELECT * FROM notes WHERE id IN (hit_ids)
        ├─ notes_by_id = {note.id: note for note in notes}
        │
        └─ return [{note: NoteListItem, score: float}, ...]
                │   ordered by similarity score (highest first)
                ▼
[Frontend] setResults(data) → render search results
        │
        └─ each result shows: title, tags, similarity % badge
```

---

## Step-by-Step Flow

### Step 1: User types in Command Palette

The `CommandPalette` component debounces the search query by 300ms before firing:

```typescript
// frontend/components/CommandPalette.tsx:86-100
useEffect(() => {
    if (!query.trim()) {
        setResults([]);
        return;
    }
    const timer = setTimeout(async () => {
        setLoading(true);
        try {
            const data = await searchApi.semantic(query, 8);
            setResults(data);
            setSelected(0);
        } catch {
            // Fallback to title-based filtering if backend unavailable
            const filtered = allNotes
                .filter(n => n.title.toLowerCase().includes(query.toLowerCase()))
                .map(n => ({ note: n, score: 1 }));
            setResults(filtered);
        } finally {
            setLoading(false);
        }
    }, 300);
    return () => clearTimeout(timer);
}, [query, allNotes]);
```

**Fallback behavior**: If the backend is unavailable, the palette falls back to client-side title substring matching.

### Step 2: API call

```
GET /search/?q=machine+learning&top_k=8
```

The backend receives the request. `top_k` defaults to 8, valid range 1–20.

### Step 3: Query embedding

```python
# backend/routers/search.py:18
query_embedding = await gemini.embed_text(q)
```

The user's query text is sent to Gemini `text-embedding-004`. The same 768-dimensional embedding space is used for both stored notes and search queries, making cosine similarity meaningful.

### Step 4: Vector similarity search

```python
# backend/services/vector.py:23-34
sql = text("""
    SELECT id, 1 - (embedding <=> :emb::vector) AS score
    FROM notes
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> :emb::vector
    LIMIT :k
""")
result = await db.execute(sql, {"emb": str(query_embedding), "k": top_k})
rows = result.fetchall()
return [(row[0], float(row[1])) for row in rows]
```

The `<=>` operator in pgvector computes cosine distance. `1 - distance = cosine_similarity`. Notes with `NULL` embedding (newly created, not yet processed) are excluded by `WHERE embedding IS NOT NULL`.

The `ORDER BY embedding <=> :emb::vector` exploits the IVFFlat index on `notes.embedding` for fast approximate nearest neighbor search.

### Step 5: Bulk note fetch (N+1 prevention)

```python
# backend/routers/search.py:24-27
hit_ids = [note_id for note_id, _ in hits]
notes_result = await db.execute(select(Note).where(Note.id.in_(hit_ids)))
notes_by_id = {note.id: note for note in notes_result.scalars().all()}
```

Instead of fetching each matched note individually (N+1 queries), a single `SELECT ... WHERE id IN (...)` fetches all of them.

### Step 6: Results assembly

```python
# backend/routers/search.py:29-34
results = []
for note_id, score in hits:
    note = notes_by_id.get(note_id)
    if note:
        results.append(SearchResult(
            note=NoteListItem.model_validate(note),
            score=score
        ))
return results
```

The results preserve the ordering from the vector search (highest similarity first). `NoteListItem` excludes the full `content` and `embedding` fields — only `id`, `title`, `created_at`, `updated_at`, `tags` are returned.

### Step 7: Frontend renders results

The command palette shows each result with:
- Title
- Tags (as `#tag-name`)
- Similarity percentage badge (when score < 1.0, i.e., when it's a semantic result not an exact match)

---

## Scoring and Ranking

### Score interpretation

| Score range | Meaning |
|-------------|---------|
| 0.90 – 1.00 | Very high similarity (near-duplicate or same topic) |
| 0.75 – 0.90 | High similarity (closely related content) |
| 0.60 – 0.75 | Moderate similarity (related domain) |
| 0.40 – 0.60 | Weak similarity (tangentially related) |
| < 0.40 | Low similarity (probably unrelated) |

The search endpoint returns all results regardless of threshold — the caller decides what to do with low-scoring results. RAG chat filters at 0.4; link suggestions filter at 0.6.

### Why semantic search is better than keyword search

A query for "how the brain processes information" will match notes about "cognitive load theory" or "working memory" even if those exact words don't appear in the query. This is because Gemini embeddings capture semantic meaning, not just lexical overlap.

---

## Search Entry Points

Search is accessible from multiple places in the UI:

### Command Palette (Ctrl+K)
The primary search interface. Accessible from anywhere. Shows actions first, then search results.

### Context Panel (note editor)
The ContextPanel automatically searches for related notes after 2 seconds of content changes:
```typescript
// frontend/components/ContextPanel.tsx:87-93
const timer = setTimeout(async () => {
    const results = await searchApi.semantic(content.slice(0, 200), 4);
    setRelated(results.filter(r => r.note.id !== noteId).slice(0, 3).map(r => r.note));
}, 2000);
```
Uses the first 200 characters of content, top_k=4, filters out the current note.

### RAG Chat
The chat endpoint embeds the user's question and uses similarity search internally (not the `/search` endpoint directly):
```python
query_embedding = await gemini.embed_text(query)
hits = await vs.similarity_search(db, query_embedding, top_k=5)
relevant_hits = [(note_id, score) for note_id, score in hits if score >= 0.4]
```

---

## Code References

| File | Lines | What |
|------|-------|------|
| `frontend/components/CommandPalette.tsx` | 80–103 | Search with debounce + fallback |
| `frontend/lib/api.ts` | 101–103 | `searchApi.semantic` |
| `backend/routers/search.py` | 12–35 | `semantic_search` endpoint |
| `backend/services/gemini.py` | 18–28 | `embed_text` |
| `backend/services/vector.py` | 18–35 | `similarity_search` |

---

## Related Documents

- [Architecture: AI](../architecture/ai.md)
- [Dataflow: RAG Chat](rag-chat.md)
- [API Reference: Search](../api/search.md)
- [Features: Search](../features/search.md)

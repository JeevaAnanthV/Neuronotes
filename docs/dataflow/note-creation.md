# Dataflow: Note Creation

This document traces the complete path of data when a user creates a new note, from the frontend action to the database and through the background embedding pipeline.

## Table of Contents
- [Overview Diagram](#overview-diagram)
- [Step-by-Step Flow](#step-by-step-flow)
- [Code References](#code-references)
- [Timing Characteristics](#timing-characteristics)

---

## Overview Diagram

```
User clicks "New Note"
        │
        ▼
[Frontend] notesApi.create("Untitled", "")
        │ POST /notes/  {"title": "Untitled", "content": ""}
        ▼
[Backend] Rate limiter checks IP (60/min)
        │
        ▼
[Backend] create_note() handler
        │
        ├─ Note(title="Untitled", content="")
        ├─ db.add(note) → db.commit()
        ├─ db.refresh(note)           ← fetches id, timestamps
        ├─ background_tasks.add_task(_embed_and_link, note.id, "", "Untitled")
        └─ return NoteRead(...)        ← HTTP 201 response sent
        │
        ▼
[Frontend] receives note.id → router.push("/notes/{id}")
        │
        ▼
[Background — async, after response]
        │
        ├─ text_to_embed = "Untitled\n"
        ├─ gemini.embed_text(text_to_embed)
        │       └─ asyncio.to_thread(_embed)
        │       └─ genai.embed_content(model, text, task_type="RETRIEVAL_DOCUMENT")
        │       └─ returns list[float] with 768 values
        │
        ├─ AsyncSessionLocal() — new DB session
        ├─ UPDATE notes SET embedding = :emb WHERE id = :id
        ├─ db.commit()
        │
        └─ recompute_links_for_note(db, note_id, threshold=0.75)
                ├─ DELETE FROM note_links WHERE source_id = :id OR target_id = :id
                └─ INSERT INTO note_links (source_id, target_id, similarity)
                   SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding) AS sim
                   FROM notes a, notes b
                   WHERE a.id < b.id
                     AND (a.id = :id OR b.id = :id)
                     AND 1 - (a.embedding <=> b.embedding) >= 0.75
```

---

## Step-by-Step Flow

### Step 1: User triggers note creation

The user clicks "New Note" in the sidebar or dashboard, or presses `Ctrl+N`.

```typescript
// frontend/components/Sidebar.tsx:86-98
const handleNewNote = async () => {
    if (creating) return;
    setCreating(true);
    try {
        const note = await notesApi.create("Untitled", "");
        await loadNotes();
        router.push(`/notes/${note.id}`);
    } catch {
        alert("Backend not connected. Please start the API server.");
    } finally {
        setCreating(false);
    }
};
```

### Step 2: API call

`notesApi.create("Untitled", "")` sends:
```
POST /notes/
Content-Type: application/json

{"title": "Untitled", "content": ""}
```

### Step 3: Middleware processing

The request passes through:
1. slowapi rate limiter (validates IP is under 60/min)
2. CORSMiddleware (validates Origin header)
3. `request_id_and_logging` middleware (assigns X-Request-ID, starts timer)

### Step 4: Route handler — `create_note`

```python
# backend/routers/notes.py:31-41
@router.post("/", response_model=NoteRead, status_code=201)
async def create_note(
    body: NoteCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    note = Note(title=body.title, content=body.content)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    background_tasks.add_task(_embed_and_link, note.id, note.content, note.title)
    return note
```

- `NoteCreate` Pydantic validation runs (title and content are strings with defaults)
- `Note` ORM object created with auto-generated `uuid.uuid4()` id
- `db.add(note)` stages the insert
- `await db.commit()` executes `INSERT INTO notes (id, title, content, created_at, updated_at) VALUES (...)`
- `await db.refresh(note)` reloads the object from DB (fetches server-side `created_at`, `updated_at`)
- `background_tasks.add_task(...)` registers `_embed_and_link` to run after the response
- The note is serialized to `NoteRead` JSON (id, title, content, created_at, updated_at, tags=[])

### Step 5: HTTP 201 response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Untitled",
  "content": "",
  "created_at": "2026-03-09T10:00:00Z",
  "updated_at": "2026-03-09T10:00:00Z",
  "tags": []
}
```

### Step 6: Frontend navigation

The frontend receives the note ID and navigates to `/notes/{id}`. The note page loads and is ready for editing. The sidebar's notes list is refreshed.

### Step 7: Background — embedding generation

FastAPI executes the background task after the response is sent:

```python
# backend/routers/notes.py:13-21
async def _embed_and_link(note_id: uuid.UUID, content: str, title: str) -> None:
    from database import AsyncSessionLocal
    text_to_embed = f"{title}\n{content}"
    embedding = await gemini.embed_text(text_to_embed)
    async with AsyncSessionLocal() as db:
        await vs.upsert_embedding(db, note_id, embedding)
        await vs.recompute_links_for_note(db, note_id)
```

The function opens a **new** database session (`AsyncSessionLocal()`) because the original request session has already been closed after the response was sent.

For an empty note ("Untitled\n"), the embedding represents the semantic meaning of the title only.

### Step 8: Embedding stored

```sql
UPDATE notes SET embedding = '[0.021, -0.034, ...]' WHERE id = '550e8400-...'
```

The 768 float values are stringified as a PostgreSQL vector literal.

### Step 9: Graph links computed

```sql
-- Delete any existing edges for this note
DELETE FROM note_links WHERE source_id = '550e8400-...' OR target_id = '550e8400-...'

-- Insert new edges above similarity threshold
INSERT INTO note_links (source_id, target_id, similarity)
SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding)
FROM notes a, notes b
WHERE a.id < b.id
  AND a.embedding IS NOT NULL
  AND b.embedding IS NOT NULL
  AND (a.id = '550e8400-...' OR b.id = '550e8400-...')
  AND 1 - (a.embedding <=> b.embedding) >= 0.75
ON CONFLICT (source_id, target_id) DO UPDATE SET similarity = EXCLUDED.similarity
```

For a freshly created empty note, this will typically produce no links (no meaningful semantic content). Once the user writes content and saves, the autosave triggers an update which schedules a new embedding + link computation.

---

## Code References

| File | Lines | What |
|------|-------|------|
| `frontend/components/Sidebar.tsx` | 86–99 | `handleNewNote` — triggers API call |
| `frontend/lib/api.ts` | 82–83 | `notesApi.create` — Axios POST |
| `backend/routers/notes.py` | 31–41 | `create_note` endpoint |
| `backend/routers/notes.py` | 13–21 | `_embed_and_link` background task |
| `backend/services/gemini.py` | 18–28 | `embed_text` |
| `backend/services/vector.py` | 7–15 | `upsert_embedding` |
| `backend/services/vector.py` | 57–83 | `recompute_links_for_note` |

---

## Timing Characteristics

| Step | Typical Duration |
|------|-----------------|
| DB insert + commit | 5–20ms |
| HTTP response sent | 20–50ms total |
| Gemini embedding API call | 200–600ms |
| DB embedding update | 5–15ms |
| Graph link recompute (small DB) | 10–50ms |
| **Total background time** | **300–700ms** |

The user sees the note page immediately. The embedding is available for search within ~1 second for most note sizes.

---

## Related Documents

- [Dataflow: Semantic Search](semantic-search.md)
- [Dataflow: Knowledge Graph](knowledge-graph.md)
- [Architecture: AI](../architecture/ai.md)
- [API Reference: Notes](../api/notes.md)

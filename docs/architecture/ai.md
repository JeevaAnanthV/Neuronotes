# AI Architecture

NeuroNotes uses Google Gemini for all AI features. Two Gemini models handle distinct workloads: `text-embedding-004` for semantic representation and `gemini-2.0-flash` for text and JSON generation. `gemini-1.5-flash` handles audio transcription.

## Table of Contents
- [Model Overview](#model-overview)
- [Embedding Pipeline](#embedding-pipeline)
- [Semantic Search](#semantic-search)
- [RAG Chat Pipeline](#rag-chat-pipeline)
- [Text Generation Features](#text-generation-features)
- [Voice Transcription](#voice-transcription)
- [Knowledge Graph Computation](#knowledge-graph-computation)
- [Insights and Gap Detection](#insights-and-gap-detection)
- [Error Handling](#error-handling)

---

## Model Overview

| Model | Use | Configured By |
|-------|-----|--------------|
| `models/text-embedding-004` | Generate 768-dim embeddings for notes and search queries | `EMBEDDING_MODEL` env var |
| `gemini-2.0-flash` | All text + JSON generation (structure, tags, flashcards, chat, insights, etc.) | `CHAT_MODEL` env var |
| `gemini-1.5-flash` | Audio transcription (voice notes, hardcoded) | Hardcoded in `transcribe_audio` |

The Gemini SDK is initialized once at module import time in `services/gemini.py`:
```python
# backend/services/gemini.py:13-15
genai.configure(api_key=settings.gemini_api_key)
_chat_model = genai.GenerativeModel(settings.chat_model)
```

---

## Embedding Pipeline

### What is embedded
Every note embedding is generated from a concatenation of title and content:
```python
# backend/routers/notes.py:16
text_to_embed = f"{title}\n{content}"
```

### When embedding happens
Embedding is triggered as a `BackgroundTask` after every note create or update. It never blocks the HTTP response.

```
POST /notes/ or PUT /notes/{id}
  → DB commit
  → HTTP response sent (note data)
  → [background] _embed_and_link(note_id, content, title)
      → gemini.embed_text(title + "\n" + content)
      → UPDATE notes SET embedding = :emb WHERE id = :id
      → recompute_links_for_note(db, note_id)
```

### The embed_text function
```python
# backend/services/gemini.py:18-28
async def embed_text(text: str) -> list[float]:
    def _embed():
        result = genai.embed_content(
            model=settings.embedding_model,
            content=text,
            task_type="RETRIEVAL_DOCUMENT",
        )
        return result["embedding"]
    return await asyncio.to_thread(_embed)
```

`task_type="RETRIEVAL_DOCUMENT"` is specified for storage embeddings. Search queries use the default (RETRIEVAL_QUERY is assumed by the model). Both use the same 768-dimensional space, so cosine similarity between them is valid.

### Embedding storage
Embeddings are stored in the `notes.embedding` column as `vector(768)`. The upsert is a raw SQL UPDATE:
```python
# backend/services/vector.py:11-14
await db.execute(
    text("UPDATE notes SET embedding = :emb WHERE id = :id"),
    {"emb": str(embedding), "id": str(note_id)},
)
```

The embedding list is cast to string and passed to pgvector which parses it as a vector literal.

---

## Semantic Search

### Flow
1. User query string arrives at `GET /search/?q=...`
2. Query is embedded: `gemini.embed_text(q)` → 768-dim vector
3. pgvector cosine similarity search: `SELECT id, 1 - (embedding <=> :emb::vector) AS score FROM notes WHERE embedding IS NOT NULL ORDER BY ... LIMIT :k`
4. Returned `(note_id, score)` pairs are bulk-fetched in one SQL query
5. Results returned in similarity-score order

### The similarity_search function
```python
# backend/services/vector.py:18-35
async def similarity_search(
    db, query_embedding, top_k=5, exclude_id=None
) -> list[tuple[uuid.UUID, float]]:
    sql = text(f"""
        SELECT id, 1 - (embedding <=> :emb::vector) AS score
        FROM notes
        WHERE embedding IS NOT NULL {exclude_clause}
        ORDER BY embedding <=> :emb::vector
        LIMIT :k
    """)
```

Scores range from -1.0 to 1.0 (cosine similarity). In practice, note embeddings are dense positive vectors so scores are typically 0.3–0.95 for related content.

### Thresholds used
| Feature | Threshold | Meaning |
|---------|-----------|---------|
| RAG chat context inclusion | ≥ 0.4 | Notes must have at least 40% similarity to be cited |
| Link suggestions | ≥ 0.6 | Notes must be 60% similar to be suggested as connections |
| Graph edge creation | ≥ 0.72 | Default for `recompute` endpoint (configurable) |
| Background per-note recompute | ≥ 0.75 | Default in `recompute_links_for_note` |

---

## RAG Chat Pipeline

Retrieval-Augmented Generation (RAG) is implemented in `POST /ai/chat`.

### Step-by-step
1. Extract the latest user message from `messages[-1]` (where `role == "user"`)
2. Embed the user message: `gemini.embed_text(query)`
3. Find top-5 semantically similar notes: `similarity_search(db, query_embedding, top_k=5)`
4. Filter to notes with similarity ≥ 0.4 (quality threshold)
5. Bulk-fetch matching notes from DB (single query)
6. Build context string: `"=== {note.title} ===\n{note.content}"` for each relevant note
7. Build conversation history string from previous messages
8. Construct prompt:
   ```
   You are a knowledgeable AI assistant with access to the user's personal notes.

   RELEVANT NOTES:
   {context or 'No relevant notes found.'}

   CONVERSATION HISTORY:
   {history}

   USER: {query}

   Answer the question based on the notes above. If the notes don't contain enough information,
   say so and answer from general knowledge.
   ```
9. Call `gemini.generate(prompt)` → reply text
10. Return `ChatResponse(reply=reply, sources=source_notes)`

### Context window management
The entire history and all relevant notes are sent in a single prompt. There is no token-based context truncation — very long conversations or very large notes could exceed Gemini's context window. The first 200 characters of content are used for related-note search in the ContextPanel (not the full content).

---

## Text Generation Features

All text generation features use `gemini.generate()` or `gemini.generate_json()`. The JSON-producing endpoints all use structured system prompts that specify the exact JSON schema.

### Note Structuring (`POST /ai/structure`)
System prompt instructs Gemini to output JSON with `title` and `structured_content` (markdown with Summary, Key Points, Action Items sections).

### Auto-tagging (`POST /ai/tags`)
System prompt requests JSON `{"tags": ["tag1", "tag2", ...]}` with 3-6 lowercase hyphenated tags.

### Flashcard Generation (`POST /ai/flashcards`)
System prompt requests JSON `{"flashcards": [{"question": "...", "answer": "..."}]}` with 3-8 cards.

### Writing Assist (`POST /ai/writing-assist`)
Five actions: `improve`, `summarize`, `expand`, `bullet`, `explain`. Each has a targeted instruction string. Returns plain text (not JSON).

### Idea Expansion (`POST /ai/expand-idea`)
Returns JSON `{"expanded": ["idea1", "idea2", ...]}` with 5-8 specific, actionable sub-ideas.

### Meeting Notes (`POST /ai/meeting-notes`)
Returns JSON with `summary`, `action_items` (list), `key_decisions` (list).

### Research Assistant (`POST /ai/research`)
Returns JSON with `summary` (2-3 sentences), `key_insights` (4-6 items), `concepts` (3-5 items).

---

## Voice Transcription

Voice notes use a multimodal Gemini model that accepts audio bytes directly.

### Flow
1. Browser records audio via `MediaRecorder` API (format: `audio/webm`)
2. Audio blob sent to `POST /ai/voice` as `multipart/form-data`
3. FastAPI reads the file bytes: `audio_bytes = await file.read()`
4. `gemini.transcribe_audio(audio_bytes, mime_type)` calls `gemini-1.5-flash`:
   ```python
   model.generate_content([
       {"mime_type": mime_type, "data": audio_bytes},
       "Transcribe this audio accurately. Return only the transcription text, nothing else.",
   ])
   ```
5. Transcription text is then sent to `generate_json` to produce a structured note:
   ```json
   {"title": "Short note title", "structured_content": "## Formatted markdown..."}
   ```
6. Returns `VoiceNoteResponse(transcript, title, structured_content)`
7. Frontend updates the note with the structured content and title

---

## Knowledge Graph Computation

The knowledge graph is built entirely from vector similarity computations, not from explicit user-defined links.

### Per-note update (background, triggered on every save)
```python
# backend/services/vector.py:57-83
async def recompute_links_for_note(db, note_id, threshold=0.75):
    # Delete existing edges for this note
    await db.execute(text("DELETE FROM note_links WHERE source_id = :id OR target_id = :id"), ...)
    # Insert new edges above threshold
    await db.execute(text("""
        INSERT INTO note_links (source_id, target_id, similarity)
        SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding) AS sim
        FROM notes a, notes b
        WHERE a.id < b.id
          AND a.embedding IS NOT NULL
          AND b.embedding IS NOT NULL
          AND (a.id = :id OR b.id = :id)
          AND 1 - (a.embedding <=> b.embedding) >= :threshold
        ON CONFLICT (source_id, target_id) DO UPDATE SET similarity = EXCLUDED.similarity
    """), ...)
```

### Full rebuild (`POST /graph/recompute?threshold=0.72`)
```python
# backend/services/vector.py:38-54
async def recompute_all_links(db, threshold=0.75):
    await db.execute(text("DELETE FROM note_links"))
    await db.execute(text("""
        INSERT INTO note_links (source_id, target_id, similarity)
        SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding)
        FROM notes a, notes b
        WHERE a.id < b.id
          AND a.embedding IS NOT NULL
          AND b.embedding IS NOT NULL
          AND 1 - (a.embedding <=> b.embedding) >= :threshold
    """), ...)
```

The default threshold for the API endpoint is `0.72` (from `graphApi.recompute(0.72)` in the frontend). The background task uses `0.75`. These values control graph density — lower thresholds produce more edges.

---

## Insights and Gap Detection

### Daily Insights (`GET /ai/insights`)
Combines database stats with AI-generated analysis:
1. Count total notes
2. Count notes created in last 7 days
3. Find the top tag (by note count)
4. Count "unfinished ideas" (notes with no tags AND content < 150 characters)
5. Fetch 5 most recently updated note titles
6. Fire two Gemini calls concurrently via `asyncio.gather`:
   - AI insight: one encouraging sentence about the user's knowledge journey
   - Suggested topics: 3-4 topics the user hasn't covered yet

### Knowledge Gap Detection (`GET /ai/gaps`)
Fetches the 30 most recently updated note titles and asks Gemini to identify 4-6 important related concepts that are missing. Returns the gaps as a list plus one sentence of encouragement.

### Link Suggestions (`GET /ai/link-suggestions/{note_id}`)
Uses `similarity_search` on the current note's embedding to find up to 3 semantically similar notes that are not already linked in the graph (similarity ≥ 0.6). Excludes already-linked notes via a raw SQL UNION query of existing `note_links`.

---

## Error Handling

### JSON parsing failures
`generate_json` strips markdown fences and catches `JSONDecodeError`, returning `{}`. Callers use `.get()` with defaults, so malformed responses never raise to the client.

### Missing embeddings
`similarity_search` filters `WHERE embedding IS NOT NULL`. Notes without embeddings (newly created, embedding still generating) are excluded from search and graph computation.

### Empty results
If no notes exceed the similarity threshold in RAG chat, the prompt includes `"No relevant notes found."` and Gemini answers from general knowledge.

### Audio processing
No retry logic — transcription failures propagate as HTTP 500. The frontend shows `"Voice processing failed."` to the user.

---

## Related Documents

- [Architecture Overview](overview.md)
- [Dataflow: Semantic Search](../dataflow/semantic-search.md)
- [Dataflow: RAG Chat](../dataflow/rag-chat.md)
- [Dataflow: Knowledge Graph](../dataflow/knowledge-graph.md)
- [API Reference: AI](../api/ai.md)

# Architecture Overview

NeuroNotes is a full-stack AI knowledge workspace. It is organized as three separate processes communicating over HTTP, backed by a single PostgreSQL database with the pgvector extension.

## Table of Contents
- [System Diagram](#system-diagram)
- [Tech Stack](#tech-stack)
- [Component Responsibilities](#component-responsibilities)
- [Design Decisions](#design-decisions)
- [Request Lifecycle](#request-lifecycle)

---

## System Diagram

```
Browser
  │
  ├─ Next.js 16 Frontend (:3000)
  │    ├─ app/          — App Router pages
  │    ├─ components/   — UI components (Editor, KnowledgeGraph, AIChat, …)
  │    └─ lib/api.ts    — typed Axios client
  │               │
  │               │ HTTP/JSON
  │               ▼
  ├─ FastAPI Backend (:8000)
  │    ├─ routers/notes.py   — CRUD; triggers background embedding
  │    ├─ routers/search.py  — semantic search via pgvector
  │    ├─ routers/ai.py      — all Gemini AI endpoints
  │    ├─ routers/graph.py   — knowledge graph data and recompute
  │    └─ routers/tags.py    — tag listing
  │         │
  │         │  services/
  │         ├─ gemini.py     — Gemini API: embed, generate, transcribe
  │         └─ vector.py     — pgvector: upsert, similarity search, link recompute
  │                    │
  │                    │ asyncpg
  │                    ▼
  └─ PostgreSQL 16 + pgvector
       ├─ notes        — id, title, content, embedding (vector 768), timestamps
       ├─ tags         — id, name
       ├─ note_tags    — note_id ↔ tag_id (many-to-many)
       └─ note_links   — source_id, target_id, similarity (graph edges)

External:
  Google Gemini API
    ├─ models/text-embedding-004  — 768-dim embeddings
    └─ gemini-2.0-flash           — text generation, JSON generation
```

---

## Tech Stack

### Frontend
| Technology | Version | Role |
|-----------|---------|------|
| Next.js | 16.1.6 | App Router, SSR/CSR pages |
| React | 19.2.3 | UI framework |
| TypeScript | 5 | Type safety |
| TipTap | 3.20 | Rich-text editor with extensions |
| React Flow | 11.11 | Interactive knowledge graph visualization |
| Axios | 1.13 | HTTP client |
| Lucide React | 0.577 | Icon library |
| Tailwind CSS | 4 | Utility-first CSS |
| Framer Motion | 12.35 | Animations |
| Supabase JS | 2.98 | Optional real-time subscriptions |

### Backend
| Technology | Version | Role |
|-----------|---------|------|
| Python | 3.12 | Runtime |
| FastAPI | 0.110+ | Async web framework |
| uvicorn | 0.27+ | ASGI server |
| SQLAlchemy | 2.0+ | Async ORM |
| asyncpg | 0.29+ | Async PostgreSQL driver |
| pgvector | 0.2.5+ | SQLAlchemy pgvector integration |
| google-generativeai | 0.5+ | Gemini SDK |
| slowapi | 0.1.9+ | Rate limiting middleware |
| pydantic-settings | 2.2+ | Configuration from env vars |
| python-multipart | 0.0.9+ | File upload parsing (voice notes) |
| alembic | 1.13+ | Database migrations |

### Database
| Technology | Role |
|-----------|------|
| PostgreSQL 16 | Primary data store |
| pgvector extension | 768-dimensional embedding storage and cosine similarity search |

### AI / External
| Service | Model | Role |
|--------|-------|------|
| Google Gemini | text-embedding-004 | 768-dim embeddings for notes and search queries |
| Google Gemini | gemini-2.0-flash | Text generation, JSON generation, RAG chat |
| Google Gemini | gemini-1.5-flash | Audio transcription for voice notes |

---

## Component Responsibilities

### Frontend Layer
The Next.js frontend handles all user interaction. It is a client-side-heavy application — every page uses `"use client"` and fetches data from the backend API at runtime. There is no server-side rendering of dynamic data.

- **`lib/api.ts`** — Single source of truth for all HTTP calls. Exports five typed API objects: `notesApi`, `tagsApi`, `searchApi`, `aiApi`, `graphApi`. All calls go to `NEXT_PUBLIC_API_URL` (default: `http://localhost:8000`).
- **`app/layout.tsx`** — Root layout rendering `Sidebar`, `MobileNav`, and `FloatingAI` around every page.
- **`components/Editor.tsx`** — TipTap editor with inline AI toolbar (appears on text selection) and slash command menu (appears on `/` keypress).
- **`components/KnowledgeGraph.tsx`** — React Flow canvas with circular node layout, tag filtering, node search, hover tooltips, and click-to-navigate.
- **`components/ContextPanel.tsx`** — Right-side panel on note pages showing AI insights, auto-tags, flashcards, idea expansion, related notes, link suggestions, and knowledge gaps.
- **`components/CommandPalette.tsx`** — Global search/command overlay (Ctrl+K) combining semantic search results with quick-action shortcuts.

### Backend Layer
The FastAPI backend exposes a REST API with five router modules. It handles all business logic, database access, and external AI calls.

- **`routers/notes.py`** — CRUD endpoints. On create/update, schedules a background task `_embed_and_link` that generates an embedding and updates graph edges without blocking the HTTP response.
- **`routers/search.py`** — Embeds the search query, runs cosine similarity via pgvector, bulk-fetches matched notes (single query, no N+1), and returns results ordered by score.
- **`routers/ai.py`** — All Gemini-powered endpoints: structure, tags, flashcards, chat (RAG), writing-assist, expand-idea, meeting-notes, insights, voice, gaps, link-suggestions, research.
- **`routers/graph.py`** — Returns all nodes and edges for the graph. `POST /graph/recompute` triggers a full pairwise similarity rebuild across all embedded notes.
- **`routers/tags.py`** — Returns all tags with note counts.

### Services Layer
Two service modules wrap external integrations:

- **`services/gemini.py`** — Wraps `google.generativeai`. All calls use `asyncio.to_thread` to avoid blocking the event loop (the SDK is synchronous). Provides: `embed_text`, `generate`, `generate_json` (with JSON fence stripping and safe fallback), `transcribe_audio`.
- **`services/vector.py`** — Wraps pgvector SQL operations: `upsert_embedding`, `similarity_search` (with optional exclusion), `recompute_all_links` (full rebuild), `recompute_links_for_note` (incremental per-note rebuild).

---

## Design Decisions

### Non-blocking embedding generation
Embedding a note via the Gemini API takes 200–800ms. To avoid making note create/update endpoints slow, embedding runs as a FastAPI `BackgroundTask`. The API responds with the saved note immediately; embedding and graph link updates happen after the response is sent.

**Trade-off:** A note's embedding may lag behind its content for a few seconds. Search results and graph edges reflect the state after the background task completes.

### Per-note graph recompute on save
Rather than rebuilding the entire graph on every save (`recompute_all_links`), the background task calls `recompute_links_for_note` which deletes and re-inserts only edges involving the current note. This is O(n) per note rather than O(n²) for the full graph.

**Full rebuild** (`POST /graph/recompute`) is provided for when the graph is stale or many notes are imported at once.

### SQL-level cosine similarity
Similarity search is done entirely in PostgreSQL using pgvector's `<=>` operator (cosine distance). The `similarity_search` function issues a single SQL query with `ORDER BY embedding <=> :emb::vector LIMIT :k`. This avoids loading all embeddings into Python and performing numpy calculations.

### N+1 prevention
Both search and chat fetch matched note IDs from vector search, then issue a single `SELECT ... WHERE id IN (...)` query to fetch the full note objects. The matching is then done in Python (dict lookup). This prevents the N+1 problem of fetching each note individually.

### JSON generation fallback
`services/gemini.py:generate_json` strips markdown code fences (` ```json ... ``` `) before parsing, and returns an empty dict on `JSONDecodeError`. Every caller uses `.get()` with a default, so malformed Gemini responses never raise exceptions to the client.

### No authentication (current)
The API has no authentication. All endpoints are publicly accessible. Rate limiting (60 req/min globally by remote IP) is the only access control. Supabase Row-Level Security is available but disabled by default.

---

## Request Lifecycle

A typical user action (e.g., typing in the editor and having a note autosave):

```
1. User types in TipTap editor
2. Editor.onChange fires → content state updated
3. scheduleSave() sets/resets a 1500ms debounce timer
4. After 1500ms idle → save() calls notesApi.update(id, {title, content})
5. Axios sends PUT /notes/{id} to FastAPI
6. FastAPI middleware assigns X-Request-ID, logs the request
7. slowapi checks rate limit (60/min by IP)
8. update_note() handler runs:
   a. Fetches note from DB
   b. Applies partial update
   c. Commits to PostgreSQL
   d. Schedules BackgroundTask: _embed_and_link(note_id, content, title)
   e. Returns updated note JSON
9. Frontend receives response → sets saving=false, saved=true
10. [Background] _embed_and_link runs asynchronously:
    a. Combines title + content into embed string
    b. Calls gemini.embed_text() → 768-dim vector
    c. UPDATE notes SET embedding = :emb WHERE id = :id
    d. recompute_links_for_note() → deletes old edges, inserts new ones above threshold
```

---

## Related Documents

- [Backend Architecture](backend.md)
- [Frontend Architecture](frontend.md)
- [Database Architecture](database.md)
- [AI Architecture](ai.md)

# NeuroNotes — System Overview

## Product Vision

NeuroNotes is an AI-powered knowledge workspace that transforms the way people capture, connect, and rediscover ideas. Unlike traditional note-taking apps that treat notes as isolated documents, NeuroNotes treats your knowledge base as a living graph — automatically linking related notes through semantic similarity, surfacing gaps in your thinking, and letting you converse with your own knowledge via a RAG-powered AI chat.

The core thesis is that knowledge compounds. A note taken today about machine learning should automatically surface when you write about statistics three weeks later. Your questions should be answered not by a generic LLM but by *your own notes* — your own thinking, reflected back with AI-amplified precision. NeuroNotes makes this happen invisibly: write a note, save it, and within seconds it is embedded, linked, and ready to connect.

What makes NeuroNotes distinct for a competition context is the breadth and depth of its AI integration. It is not a wrapper around a chat API. It features: semantic search over a pgvector store, a real-time knowledge graph built from cosine similarity between 768-dimensional note embeddings, spaced repetition flashcards with the SM-2 algorithm, AI writing coaching that fires after 2 seconds of inactivity, voice-to-structured-note transcription via Gemini multimodal, and a gap analysis engine that identifies what your knowledge base is missing. Every feature is tightly integrated, not bolted on.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BROWSER (port 2323)                              │
│                                                                         │
│  Next.js 16 App Router — React 18 + TypeScript                          │
│                                                                         │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  /app pages │  │ /components│  │  lib/api.ts  │  │ lib/supabase │  │
│  │  (RSC + CC) │  │  (client)  │  │ (axios REST) │  │ (@supabase/  │  │
│  └──────┬──────┘  └─────┬──────┘  └──────┬───────┘  │   ssr)       │  │
│         │               │                │           └──────┬───────┘  │
└─────────┼───────────────┼────────────────┼──────────────────┼──────────┘
          │               │         HTTP REST                 │
          │               │         (port 8001)               │ WebSocket
          ▼               ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (port 8001)                         │
│                                                                         │
│  main.py ── CORS, rate limiting (slowapi 60/min), request ID logging    │
│                                                                         │
│  routers/                                                               │
│  ├─ notes.py   CRUD + BackgroundTask embedding trigger                  │
│  ├─ search.py  semantic search endpoint                                 │
│  ├─ ai.py      all AI features (14 endpoints)                           │
│  ├─ graph.py   knowledge graph fetch + full recompute                   │
│  └─ tags.py    tag listing with note counts                             │
│                                                                         │
│  services/                                                              │
│  ├─ gemini.py  Gemini API wrapper (embed, generate, generate_json,      │
│  │             transcribe_audio) with error → HTTPException mapping     │
│  └─ vector.py  pgvector RPC calls (upsert, similarity search,          │
│                incremental link recompute)                              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS REST (supabase-py)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Supabase (PostgreSQL 16 + pgvector)                   │
│                                                                         │
│  tables:                                                                │
│  ├─ notes        (id, title, content, embedding vector(768), timestamps)│
│  ├─ tags         (id, name unique)                                      │
│  ├─ note_tags    (note_id FK, tag_id FK) — M:N join                     │
│  ├─ note_links   (source_id, target_id, similarity) — graph edges       │
│  └─ flashcards   (id, note_id, question, answer, SM-2 fields)          │
│                                                                         │
│  RPC functions (PostgreSQL):                                            │
│  ├─ upsert_note_embedding(note_id, vector)                              │
│  ├─ similarity_search(query_embedding, match_count, match_threshold)    │
│  ├─ recompute_note_links(threshold) — full graph rebuild                │
│  └─ recompute_links_for_note(p_note_id, p_threshold) — incremental     │
│                                                                         │
│  Auth: Supabase Magic Link OTP (passwordless)                           │
│  Realtime: postgres_changes + Presence channels                         │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                         Google Gemini API
                         ├─ gemini-2.5-flash      (text generation)
                         └─ gemini-embedding-001  (768-dim embeddings)
```

---

## Feature Catalog

| Feature | Description |
|---------|-------------|
| **Magic Link Auth** | Passwordless sign-in via Supabase OTP. Users enter email, receive a link, click it — session persists via SSR cookie managed by `@supabase/ssr`. |
| **Note CRUD** | Create, read, update, delete notes. Auto-save with 1.5s debounce. Keyboard shortcut `Ctrl+S` for immediate save. |
| **TipTap Rich Editor** | Block-based editor with ProseMirror under the hood. Supports headings, bold, italic, lists, code blocks. |
| **Slash Commands** | Type `/` in the editor to open an AI command palette: summarize, expand, generate flashcards, structure, generate tags, research, meeting notes. |
| **AI Text Assist** | Select any text → floating toolbar → choose: Improve, Summarize, Expand, Bullets, Explain Simply. The selected text is replaced with the AI result. |
| **Ghost Writing Coach** | After 2 seconds of writing inactivity with ≥50 chars in the current paragraph, Gemini suggests a single continuation sentence. Tab to accept, Escape to dismiss. |
| **AI Note Structuring** | Converts raw, stream-of-consciousness text into a formatted note with Summary, Key Points, and Action Items sections. |
| **Auto-Tagging** | Sends note content to Gemini → returns 3-6 lowercase hyphenated topic tags → adds them to the note via the tags API. |
| **Semantic Search** | Type a natural language query → embed it with Gemini → cosine similarity search via pgvector → ranked note results. |
| **Knowledge Graph** | Force-directed graph (React Flow) showing notes as nodes and semantic similarity as weighted edges. Edge opacity and width scale with similarity score; edges >0.9 similarity animate. Filterable by tag. |
| **RAG Chat** | Conversational AI that retrieves the top-5 most relevant notes as context before answering. Sources are shown below each reply. Callers can also pin specific notes as context. |
| **Flashcard Generation** | Gemini generates 3-8 Q&A flashcard pairs from note content. Cards are saved to the `flashcards` table and reviewed via a flip-card UI. |
| **Spaced Repetition** | SM-2 algorithm implementation. After each flashcard review (quality 0-5), the interval and easiness factor are updated. `next_review` is set to `now + interval days`. |
| **Voice Notes** | Record audio directly in the browser (MediaRecorder API). Audio is sent to Gemini multimodal for transcription, then structured into a titled markdown note. |
| **Daily Insights** | Dashboard widget showing: total notes, notes this week, top topic by tag frequency, unfinished ideas count, AI-generated encouragement, and suggested topics. |
| **Knowledge Gap Analysis** | Examines your 30 most recent note titles and asks Gemini to identify 4-6 important related concepts you haven't covered. |
| **Link Suggestions** | For a given note, finds the top related notes that are not yet connected in the knowledge graph. Uses the note's stored embedding for similarity. |
| **Topic Clusters** | Groups notes by their primary tag into visual clusters, showing the top 3 notes per topic. |
| **Meeting Notes Extraction** | Paste a meeting transcript → Gemini extracts: summary, action items, and key decisions. |
| **Idea Expansion** | Give Gemini a short idea → it generates 5-8 specific, actionable sub-ideas. |
| **Research Assistant** | Paste an article or paper → Gemini returns: 2-3 sentence summary, 4-6 key insights, 3-5 important concepts. |
| **Action Item Extraction** | Scans note content for tasks, reminders, and commitments. Assigns priority (high/medium/low) and extracts due date hints. |
| **Template Filler** | AI fills predefined note templates (meeting notes, research, project plan, etc.) with contextually relevant placeholder content. |
| **Real-time Collaboration** | Multiple users on the same note see each other's presence avatars (initials colored by user ID hash) via Supabase Realtime Presence channels. |
| **Real-time Note Updates** | When another user saves a note you have open, a toast notification appears via `postgres_changes` subscription. |
| **Command Palette** | `Ctrl+K` opens a universal command palette: create note, navigate, search, access any feature. |
| **Tag Management** | Create, apply, remove tags. Tag list page shows all tags with note counts, sorted by frequency. |
| **Dark Mode UI** | Fully dark design system with CSS custom properties. No light mode toggle — consistent dark-first aesthetic optimized for focus. |

---

## Technical Deep Dives

### Authentication Flow (step by step)

```
1. User visits any non-/auth route
      ↓
2. middleware.ts runs (Next.js Edge Runtime)
   - Creates a Supabase server client with cookie adapter
   - Calls supabase.auth.getUser() to validate the session cookie
   - If no valid user → redirect to /auth
   - If valid user → pass through (refreshing the session cookie)

3. User is on /auth page
   - "use client" page; no SSR (avoids prerender issues with window access)
   - supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: origin/auth/callback } })
   - Shows "Check your email" state

4. User clicks magic link in email
   - Browser navigates to /auth/callback?code=<PKCE_code>
   - Route handler (GET) calls supabase.auth.exchangeCodeForSession(code)
   - Session tokens are written as HttpOnly cookies on the response
   - Browser is redirected to / with session established

5. Subsequent requests
   - middleware.ts reads session cookie, calls getUser() to verify
   - Cookie is refreshed transparently if near expiry
   - Session persists across tabs (shared cookie) and page refreshes
```

The critical implementation detail is that the callback route builds the `NextResponse.redirect()` *before* creating the Supabase server client, then passes that response object into the cookie `setAll` handler. This ensures session cookies are set on the redirect response — a common source of auth bugs in Next.js App Router projects.

### AI Pipeline (how notes become knowledge)

```
User saves/creates a note
         ↓
FastAPI returns the note immediately (non-blocking)
         ↓
BackgroundTask fires: _embed_and_link(note_id, content, title)
         ↓
gemini.embed_text(f"{title}\n{content}")
  → Gemini embedding-001 API
  → 768-dimensional float vector
         ↓
vs.upsert_embedding(note_id, embedding)
  → Supabase RPC: upsert_note_embedding
  → UPDATE notes SET embedding = $vector WHERE id = $note_id
         ↓
vs.recompute_links_for_note(note_id)
  → Supabase RPC: recompute_links_for_note
  → DELETE stale edges for this note
  → INSERT new edges: cosine_similarity >= 0.75
  → Uses least()/greatest() to ensure canonical edge direction
         ↓
Knowledge graph is updated; next GET /graph reflects new links
```

For semantic search and RAG chat, the pipeline runs synchronously (the user waits for the embedding):

```
User query string
    → gemini.embed_text(query)        # Gemini API call
    → vs.similarity_search(embedding) # pgvector: 1 - (embedding <=> query_embedding)
    → fetch note content from DB
    → for RAG: inject as context into Gemini generate() call
    → return reply + source notes
```

### Real-time Collaboration (presence + postgres_changes)

Two independent Supabase Realtime mechanisms are used:

**Presence (who is viewing)**
```typescript
// CollaborativeIndicator.tsx
supabase.auth.getUser().then(({ data }) => {
  const userId = data.user?.id ?? `anon-${random}`;
  const displayName = data.user?.email?.split("@")[0] ?? userId.slice(0, 6);

  const channel = supabase.channel(`note-presence:${noteId}`, {
    config: { presence: { key: userId } },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      // Build viewers list from presence state, excluding self
      const state = channel.presenceState();
      setViewers(Object.entries(state)
        .filter(([id]) => id !== userId)
        .map(([id, presences]) => ({ user_id: id, name: presences[0].name, ... }))
      );
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name: displayName, joined_at: Date.now() });
      }
    });
});
```

Presence state is stored in Supabase's in-memory presence server (not the database). Each connected client tracks its own key. When a client disconnects, its key is automatically removed — no cleanup code required.

**postgres_changes (content updates)**
```typescript
// notes/[id]/page.tsx
supabase
  .channel(`note:${id}`)
  .on("postgres_changes",
    { event: "UPDATE", schema: "public", table: "notes", filter: `id=eq.${id}` },
    () => setRealtimeToast(true)  // "Another user updated this note"
  )
  .subscribe();
```

This fires whenever any client saves to the backend REST API and the DB row changes. The frontend shows a toast; users can manually reload to see the latest content.

### Semantic Search (vector embeddings + cosine similarity)

pgvector uses the `<=>` operator for cosine distance (0 = identical, 2 = opposite). The similarity score used throughout the system is `1 - cosine_distance`.

```sql
-- similarity_search RPC
SELECT n.id, 1 - (n.embedding <=> query_embedding) AS score
FROM notes n
WHERE
  n.embedding IS NOT NULL
  AND 1 - (n.embedding <=> query_embedding) >= match_threshold
ORDER BY n.embedding <=> query_embedding  -- ascending distance = descending similarity
LIMIT match_count;
```

The IVFFlat index (`lists = 100`) provides approximate nearest-neighbor search. For a knowledge base with hundreds to low thousands of notes, this gives sub-millisecond query times while maintaining high recall.

Similarity thresholds used across the system:
- Semantic search: `>= 0.4` (broad recall)
- RAG chat context: `>= 0.4` (same — cast wide net for context)
- Knowledge graph links: `>= 0.75` (high confidence only)
- Link suggestions: `>= 0.6` (medium confidence)

### Spaced Repetition (SM-2 algorithm implementation)

The SM-2 algorithm (SuperMemo 2) determines optimal review intervals to commit flashcards to long-term memory:

```python
# backend/routers/ai.py — review_flashcard endpoint
quality = max(0, min(5, quality))  # clamp input to [0, 5]

# Update easiness factor (how "easy" the card is, floor 1.3)
new_easiness = max(1.3, easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

# Update repetition count (reset to 0 on failure: quality < 3)
new_repetitions = repetitions + 1 if quality >= 3 else 0

# Compute next interval in days
if new_repetitions <= 1:
    new_interval = 1       # review tomorrow
elif new_repetitions == 2:
    new_interval = 6       # review in 6 days
else:
    new_interval = round(interval * new_easiness)  # exponential growth

# Schedule next review
next_review = (datetime.now(UTC) + timedelta(days=new_interval)).isoformat()
```

A card answered with quality=5 (perfect) on an easiness of 2.5 grows its interval by 2.5x each review: 1 → 6 → 15 → 37 → 93 days. A card consistently answered poorly (quality=0) never advances and is reviewed again the next day.

---

## Database Schema

### Tables

**`notes`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `title` | `varchar(500)` | Default `'Untitled'` |
| `content` | `text` | HTML from TipTap editor |
| `embedding` | `vector(768)` | Gemini embedding-001 output |
| `created_at` | `timestamptz` | Set on insert |
| `updated_at` | `timestamptz` | Auto-updated by trigger |

**`tags`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `name` | `varchar(100)` | Unique |

**`note_tags`** — M:N join
| Column | Type | Notes |
|--------|------|-------|
| `note_id` | `uuid` | FK → notes, CASCADE DELETE |
| `tag_id` | `uuid` | FK → tags, CASCADE DELETE |

**`note_links`** — Knowledge graph edges
| Column | Type | Notes |
|--------|------|-------|
| `source_id` | `uuid` | FK → notes, CASCADE DELETE |
| `target_id` | `uuid` | FK → notes, CASCADE DELETE |
| `similarity` | `float` | Cosine similarity score [0, 1] |

**`flashcards`** — SM-2 spaced repetition
| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `note_id` | `uuid` | FK → notes, CASCADE DELETE |
| `question` | `text` | |
| `answer` | `text` | |
| `easiness` | `float` | SM-2 E-factor, default 2.5 |
| `repetitions` | `int` | Review count, resets on failure |
| `interval` | `int` | Days until next review |
| `next_review` | `timestamptz` | When this card is due |

### Indexes
- `notes_embedding_idx` — IVFFlat on `embedding` with `vector_cosine_ops`, `lists=100`
- `flashcards_note_id_idx` — B-tree on `note_id`
- `flashcards_next_review_idx` — B-tree on `next_review` (for efficient due-card queries)

---

## API Reference

### Notes (`/notes`)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/notes/` | List all notes (ordered by updated_at desc) |
| `POST` | `/notes/` | Create note; triggers background embedding |
| `GET` | `/notes/{id}` | Get note with tags |
| `PUT` | `/notes/{id}` | Update note; triggers background re-embedding |
| `DELETE` | `/notes/{id}` | Delete note (cascades to tags, links, flashcards) |
| `POST` | `/notes/{id}/tags/{tag_name}` | Add tag to note (creates tag if new) |
| `DELETE` | `/notes/{id}/tags/{tag_name}` | Remove tag from note |

### Search (`/search`)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/search/?q=...&top_k=8` | Semantic search; returns notes with similarity scores |

### AI (`/ai`)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ai/structure` | Structure raw text into titled markdown note |
| `POST` | `/ai/tags` | Generate 3-6 topic tags for content |
| `POST` | `/ai/flashcards` | Generate 3-8 Q&A flashcard pairs |
| `POST` | `/ai/chat` | RAG chat with note context |
| `POST` | `/ai/writing-assist` | Transform text (improve/summarize/expand/bullet/explain) |
| `POST` | `/ai/writing-coach` | Single-sentence continuation suggestion |
| `POST` | `/ai/expand-idea` | Generate 5-8 sub-ideas from a short idea |
| `POST` | `/ai/meeting-notes` | Extract summary, actions, decisions from transcript |
| `POST` | `/ai/voice` | Transcribe audio + structure into note |
| `POST` | `/ai/research` | Summarize article/paper + extract insights |
| `POST` | `/ai/extract-actions` | Extract action items with priority and due hints |
| `POST` | `/ai/template-fill` | Fill a note template with AI-generated content |
| `GET` | `/ai/insights` | Daily dashboard insights (stats + AI reflection) |
| `GET` | `/ai/gaps` | Identify knowledge gaps from note titles |
| `GET` | `/ai/clusters` | Group notes by tag into topic clusters |
| `GET` | `/ai/link-suggestions/{note_id}` | Find unlinked related notes |
| `GET` | `/ai/flashcards/{note_id}/due` | Return flashcards due for review |
| `POST` | `/ai/flashcards/{note_id}/review` | Update SM-2 state after review |
| `POST` | `/ai/flashcards/{note_id}/save` | Persist AI-generated flashcards to DB |

### Graph (`/graph`)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/graph/` | Fetch all nodes and edges |
| `POST` | `/graph/recompute?threshold=0.72` | Rebuild entire note_links table |

### Tags (`/tags`)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tags/` | List all tags with note counts (sorted by frequency) |

### Health
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |

---

## Security Model

### Authentication
- **Frontend**: Supabase Magic Link OTP. No passwords. Session managed as HttpOnly cookies via `@supabase/ssr`. Middleware enforces auth on all non-`/auth` routes.
- **Backend**: Uses the Supabase **service role key** to bypass Row-Level Security. This key is stored in `backend/.env` (never committed; covered by `.gitignore`). The backend itself has no JWT validation — it is protected by CORS and should run behind a network boundary or API gateway in production.
- **CORS**: Explicitly whitelisted origins only (`http://localhost:2323`, `http://localhost:3000`). `allow_credentials=True` ensures cookies flow correctly.

### Rate Limiting
- 60 requests per minute globally (per IP, via slowapi).
- `RateLimitExceeded` returns HTTP 429 with a standard error body.
- The frontend surfaces 429 errors with a user-friendly alert.

### Input Validation
- All request bodies are validated by Pydantic schemas before reaching route handlers.
- `note_id` path parameters are typed as `uuid.UUID` — FastAPI rejects malformed UUIDs with 422.
- Query parameters use `Query(..., min_length=1)` constraints.

### XSS
- Note content is rendered via TipTap's `EditorContent`, which uses ProseMirror's sanitized DOM rendering — no raw `innerHTML` with user content.
- The `content` field stored in the database is HTML, but it is only ever rendered back through TipTap.

### Secrets Management
- `backend/.env` — service role key and Gemini API key. Covered by `.gitignore`.
- `frontend/.env.local` — Supabase URL and anon key (public by design; anon key is safe to expose). Covered by `.gitignore`.
- `.env.example` files exist for both backend and frontend to document required variables without exposing values.

---

## Performance Characteristics

**What is fast:**
- Note list and CRUD: single Supabase REST call, typically < 100ms round-trip.
- Semantic search: IVFFlat index makes pgvector queries sub-millisecond on the DB side. Total latency dominated by the Gemini embedding call (~300-600ms).
- Knowledge graph fetch: single `SELECT *` on `note_links` — instant for typical knowledge base sizes (< 10k notes).
- AI writing coach: fires asynchronously in the background; does not block the editor.

**What is slower:**
- Note save with embedding: the response returns immediately (< 200ms), but the background embedding task takes 1-3 seconds depending on Gemini API latency. The graph reflects the new note after this background task completes.
- RAG chat: requires one embedding call (query) + similarity search + one generation call. Total 2-5 seconds.
- Full graph recompute (`POST /graph/recompute`): O(n²) pairwise similarity computation via PostgreSQL. Suitable for up to ~1000 notes; beyond that, an incremental approach (already implemented as `recompute_links_for_note`) should be the default.
- Voice transcription: depends on audio length. Gemini multimodal processes at approximately real-time speed.

**Scalability notes:**
- The IVFFlat index requires at least `lists × 39` rows to be effective (roughly 3,900 notes for `lists=100`). For smaller datasets, a flat (exact) search via `<=>` without an index may outperform IVFFlat. This is a known tradeoff and appropriate for a competition project.
- The Supabase free tier has a 500MB database limit and rate limits on realtime connections. Both are generous for demo purposes.

---

## Development Guide

### Prerequisites
- Node.js 20+
- Python 3.11+
- A Supabase project with pgvector enabled
- A Google Gemini API key

### Local Setup

**1. Clone and set up environment files**
```bash
git clone https://github.com/JeevaAnanthV/Neuronotes.git
cd Neuronotes

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**2. Initialize the database**
```
Open Supabase Dashboard → SQL Editor → paste contents of supabase/schema.sql → Run
```

**3. Run the backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
# API docs: http://localhost:8001/docs
```

**4. Run the frontend**
```bash
cd frontend
npm install
npm run dev
# App: http://localhost:2323
```

### Docker (full stack)
```bash
# Ensure backend/.env is populated
docker compose up -d
# Frontend: http://localhost:2323
# Backend:  http://localhost:8001
```

### Running Tests
```bash
cd backend
pytest tests/ -v
pytest tests/test_notes.py -v  # single file
```

### Type Checking
```bash
cd frontend
npx tsc --noEmit
npm run lint
```

---

## Competition Highlights

### Why NeuroNotes stands out

**1. True AI integration, not a chatbot wrapper.**
Every feature — from auto-tagging to writing coaching to knowledge gap analysis — is a purpose-built AI pipeline. The RAG chat queries your *own notes* before answering. The writing coach reads the current paragraph context. The knowledge graph is computed from real vector similarity, not keyword overlap.

**2. Production-grade architecture.**
- Non-blocking embedding: background tasks mean note saves never feel slow.
- Request ID logging: every HTTP request gets a UUID for traceability.
- Rate limiting: prevents abuse without blocking legitimate use.
- Type safety end to end: Pydantic on the backend, TypeScript on the frontend, shared schema conventions.
- SSR-safe auth: `@supabase/ssr` with proper cookie handling in middleware, callback route, and client components.

**3. Real-time collaboration done right.**
Presence uses real Supabase Auth user IDs and display names — not anonymous random strings. `postgres_changes` subscriptions notify collaborators of content updates in real time, with row-level filtering (`filter: 'id=eq.{noteId}'`) to avoid noisy broadcasts.

**4. Spaced repetition with SM-2.**
Full implementation of the SuperMemo 2 algorithm with persistent state (easiness factor, repetition count, interval, next review timestamp). This is not a toy flashcard feature — it is a functional learning system integrated into the note workflow.

**5. Rich editor with AI superpower.**
TipTap + ProseMirror provides a block editor foundation. The ghost writing coach (fires after 2s of inactivity), AI toolbar on text selection (no click required — appears on highlight), and slash command palette (7 commands, keyboard-navigable) make the editor feel genuinely intelligent.

**6. Knowledge graph as first-class feature.**
The graph page uses React Flow for interactive visualization. Nodes are filterable by tag. Edge weight and opacity encode semantic similarity. Animated edges indicate very high similarity (>0.87). Clicking a node navigates to the note. The recompute endpoint lets users rebuild the full graph on demand.

**7. Clean, maintainable codebase.**
~3,500 lines of application code (excluding dependencies). Clear module boundaries: routers call services; services call external APIs; database access is isolated in `database/`. Frontend components are small and composable. No circular imports, no god components.

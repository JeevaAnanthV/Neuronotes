# Backend Architecture

The NeuroNotes backend is a Python FastAPI application running on uvicorn. It provides a REST API at port 8000 and uses SQLAlchemy async for database access.

## Table of Contents
- [File Structure](#file-structure)
- [Application Bootstrap](#application-bootstrap)
- [Middleware Stack](#middleware-stack)
- [Dependency Injection](#dependency-injection)
- [Router Modules](#router-modules)
- [Service Modules](#service-modules)
- [Configuration](#configuration)
- [Async Patterns](#async-patterns)
- [Error Handling](#error-handling)

---

## File Structure

```
backend/
├── main.py          — FastAPI app, middleware, router registration, lifespan
├── config.py        — Pydantic settings (reads .env)
├── database.py      — SQLAlchemy engine + session factory + get_db()
├── models.py        — SQLAlchemy ORM models (Note, Tag, NoteTag, NoteLink)
├── schemas.py       — Pydantic request/response models
├── requirements.txt — Python dependencies
├── Dockerfile       — Production container (python:3.12-slim)
├── pytest.ini       — asyncio_mode = auto, testpaths = tests
├── .env             — Environment variables (not committed)
├── routers/
│   ├── __init__.py
│   ├── notes.py     — CRUD + tag management for notes
│   ├── search.py    — Semantic search endpoint
│   ├── ai.py        — All Gemini AI endpoints
│   ├── graph.py     — Graph data retrieval + recompute
│   └── tags.py      — Tag listing with counts
└── services/
    ├── __init__.py
    ├── gemini.py    — Gemini API wrapper
    └── vector.py    — pgvector operations
```

---

## Application Bootstrap

`main.py` creates and configures the FastAPI application using a lifespan context manager.

```python
# backend/main.py:27-36
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("NeuroNotes API starting up…")
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    logger.info("Database tables ready.")
    yield
    logger.info("NeuroNotes API shutting down.")
    await engine.dispose()
```

On startup, `create_all` ensures all tables defined in `models.py` exist. This is safe for development but production schema changes should use Alembic migrations. On shutdown, the connection pool is disposed cleanly.

The app is defined with OpenAPI metadata:
```python
# backend/main.py:39-44
app = FastAPI(
    title="NeuroNotes API",
    description="AI-Powered Intelligent Knowledge Workspace",
    version="1.0.0",
    lifespan=lifespan,
)
```

Routers are registered at the module level after middleware setup:
```python
# backend/main.py:69-75
from routers import notes, search, ai, graph, tags

app.include_router(notes.router)    # prefix: /notes
app.include_router(search.router)   # prefix: /search
app.include_router(ai.router)       # prefix: /ai
app.include_router(graph.router)    # prefix: /graph
app.include_router(tags.router)     # prefix: /tags
```

A health check endpoint is registered directly on the app:
```
GET /health → {"status": "ok", "service": "NeuroNotes API"}
```

---

## Middleware Stack

Middleware is applied in this order (outermost to innermost):

### 1. slowapi Rate Limiter
```python
# backend/main.py:24, 46-47
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Rate limited by remote IP address. Default: `60/minute`. Configurable via the `RATE_LIMIT` environment variable. Returns HTTP 429 on violation.

### 2. CORSMiddleware
```python
# backend/main.py:49-55
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Allowed origins come from `CORS_ORIGINS` env var. Default: `["http://localhost:3000"]`. In production, set this to your frontend domain.

### 3. Request ID and Logging Middleware
```python
# backend/main.py:58-67
@app.middleware("http")
async def request_id_and_logging(request: Request, call_next) -> Response:
    request_id = str(uuid.uuid4())[:8]
    start = time.perf_counter()
    response: Response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    logger.info("%s %s %d (%.1fms) [%s]", ...)
    return response
```

Every response gets an `X-Request-ID` header (8-char truncated UUID) for tracing. Request duration is logged at INFO level.

---

## Dependency Injection

`database.py` defines the `get_db` async generator used as a FastAPI dependency:

```python
# backend/database.py:15-17
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

Session configuration:
- `expire_on_commit=False` — SQLAlchemy objects remain accessible after commit (avoids lazy-load errors in async context)
- `pool_pre_ping=True` on engine — validates connections before use (handles Supabase connection timeouts)

Usage in route handlers:
```python
@router.get("/", response_model=list[NoteListItem])
async def list_notes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).order_by(Note.updated_at.desc()))
    return result.scalars().all()
```

---

## Router Modules

### notes.py — `/notes`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notes/` | List all notes, ordered by `updated_at` desc |
| POST | `/notes/` | Create note; schedules background embedding |
| GET | `/notes/{note_id}` | Get single note with tags |
| PUT | `/notes/{note_id}` | Partial update; reschedules background embedding |
| DELETE | `/notes/{note_id}` | Delete note (cascades to note_tags, note_links) |
| POST | `/notes/{note_id}/tags/{tag_name}` | Add tag (creates tag if new) |
| DELETE | `/notes/{note_id}/tags/{tag_name}` | Remove tag from note |

**Background embedding task** (`_embed_and_link`):
```python
# backend/routers/notes.py:13-21
async def _embed_and_link(note_id: uuid.UUID, content: str, title: str) -> None:
    text_to_embed = f"{title}\n{content}"
    embedding = await gemini.embed_text(text_to_embed)
    async with AsyncSessionLocal() as db:
        await vs.upsert_embedding(db, note_id, embedding)
        await vs.recompute_links_for_note(db, note_id)
```

Note: The background task creates its own database session (`AsyncSessionLocal()`) because it runs outside the request/response lifecycle after the original session is closed.

### search.py — `/search`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search/?q=...&top_k=8` | Semantic search over note embeddings |

Parameters: `q` (required, min 1 char), `top_k` (1-20, default 8).

### ai.py — `/ai`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/structure` | Structure raw text into title + markdown |
| POST | `/ai/tags` | Generate 3-6 topic tags |
| POST | `/ai/flashcards` | Generate 3-8 flashcards |
| POST | `/ai/chat` | RAG chat with knowledge base |
| POST | `/ai/writing-assist` | improve/summarize/expand/bullet/explain |
| POST | `/ai/expand-idea` | Generate 5-8 sub-ideas |
| POST | `/ai/meeting-notes` | Extract summary, action items, decisions |
| GET | `/ai/insights` | Stats + AI insight + suggested topics |
| POST | `/ai/voice` | Transcribe audio + structure as note |
| GET | `/ai/gaps` | Detect knowledge gaps in note collection |
| GET | `/ai/link-suggestions/{note_id}` | Find semantically similar unlinked notes |
| POST | `/ai/research` | Summarize article and extract key insights |

### graph.py — `/graph`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/graph/` | All nodes (notes) and edges (note_links) |
| POST | `/graph/recompute?threshold=0.72` | Full pairwise similarity rebuild |

### tags.py — `/tags`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tags/` | All tags with note counts, ordered by count |

---

## Service Modules

### services/gemini.py

All methods are `async` and use `asyncio.to_thread` to wrap synchronous Gemini SDK calls without blocking the event loop.

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

`generate_json` strips markdown code fences from Gemini's response before parsing, and returns `{}` on `JSONDecodeError`:

```python
# backend/services/gemini.py:41-53
async def generate_json(prompt: str, system: str | None = None) -> Any:
    raw = await generate(prompt, system)
    cleaned = re.sub(r"```(?:json)?\s*([\s\S]*?)```", r"\1", raw).strip()
    try:
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Gemini returned non-JSON response: %s", cleaned[:200])
        return {}
```

Voice transcription uses `gemini-1.5-flash` (multimodal model):
```python
# backend/services/gemini.py:56-66
async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    model = genai.GenerativeModel("gemini-1.5-flash")
    def _transcribe():
        return model.generate_content([
            {"mime_type": mime_type, "data": audio_bytes},
            "Transcribe this audio accurately. Return only the transcription text, nothing else.",
        ]).text
    return await asyncio.to_thread(_transcribe)
```

### services/vector.py

Executes raw SQL via SQLAlchemy `text()` for pgvector operations (the pgvector ORM integration does not yet support all operators ergonomically in SQLAlchemy 2.0 async).

**`similarity_search`** — Returns `(note_id, score)` tuples:
```python
# backend/services/vector.py:18-35
sql = text(f"""
    SELECT id, 1 - (embedding <=> :emb::vector) AS score
    FROM notes
    WHERE embedding IS NOT NULL {exclude_clause}
    ORDER BY embedding <=> :emb::vector
    LIMIT :k
""")
```

The score is `1 - cosine_distance` (i.e., cosine similarity). Higher is more similar.

**`recompute_links_for_note`** — Incremental graph update for a single note:
```python
# backend/services/vector.py:57-82
# Delete all edges involving this note
await db.execute(text("DELETE FROM note_links WHERE source_id = :id OR target_id = :id"), ...)
# Insert new edges above threshold
await db.execute(text("""
    INSERT INTO note_links (source_id, target_id, similarity)
    SELECT a.id, b.id, 1 - (a.embedding <=> b.embedding)
    FROM notes a, notes b
    WHERE a.id < b.id  -- prevents duplicate pairs
      AND (a.id = :id OR b.id = :id)
      AND 1 - (a.embedding <=> b.embedding) >= :threshold
    ON CONFLICT (source_id, target_id) DO UPDATE SET similarity = EXCLUDED.similarity
"""), ...)
```

The `a.id < b.id` condition ensures each pair is only considered once (no `(A,B)` and `(B,A)` duplicates).

---

## Configuration

`config.py` uses `pydantic-settings` to read from environment variables and `.env` file:

```python
# backend/config.py
class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://neuronotes:neuronotes@localhost:5432/neuronotes"
    gemini_api_key: str = ""
    embedding_model: str = "models/text-embedding-004"
    chat_model: str = "gemini-2.0-flash"
    cors_origins: list[str] = ["http://localhost:3000"]
    rate_limit: str = "60/minute"
```

Settings are cached with `@lru_cache()` — the `Settings` object is constructed once and reused. This is why environment variables are read at startup, not per-request.

---

## Async Patterns

1. **All DB operations are async** — SQLAlchemy 2.0 async sessions with `await db.execute(...)`.
2. **External AI calls use `asyncio.to_thread`** — The Gemini SDK is synchronous; wrapping in `to_thread` prevents blocking the FastAPI event loop.
3. **Background tasks use separate sessions** — `BackgroundTask` runs after the response is sent, so it must open a new `AsyncSessionLocal()` session rather than reusing the request session.
4. **`asyncio.gather` for concurrent AI calls** — The `/ai/insights` endpoint fires two Gemini calls concurrently:
   ```python
   ai_insight_raw, suggested_data = await asyncio.gather(
       ai_insight_task, suggested_topics_task
   )
   ```

---

## Error Handling

- **404 Not Found** — Raised explicitly when a note or tag does not exist (`raise HTTPException(status_code=404, detail="Note not found")`).
- **429 Rate Limited** — Handled by slowapi's `_rate_limit_exceeded_handler`.
- **Gemini failures** — `generate_json` returns `{}` on JSON parse errors. Network errors from Gemini propagate as HTTP 500 to the client (unhandled).
- **DB errors** — SQLAlchemy exceptions propagate as HTTP 500. No explicit retry logic.

---

## Related Documents

- [Architecture Overview](overview.md)
- [Database Architecture](database.md)
- [AI Architecture](ai.md)
- [API Reference: Notes](../api/notes.md)
- [API Reference: AI](../api/ai.md)

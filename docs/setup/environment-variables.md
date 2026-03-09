# Environment Variables

All environment variables for NeuroNotes. Backend variables go in `backend/.env`; frontend variables go in `frontend/.env.local`.

---

## Backend Variables

### `DATABASE_URL`

| Property | Value |
|----------|-------|
| Required | Yes |
| Format | SQLAlchemy async URL |
| Default | `postgresql+asyncpg://neuronotes:neuronotes@localhost:5432/neuronotes` |

Connection string for PostgreSQL with the asyncpg driver.

**Local Docker:**
```
DATABASE_URL=postgresql+asyncpg://neuronotes:neuronotes@localhost:5432/neuronotes
```

**Supabase (connection pooler):**
```
DATABASE_URL=postgresql+asyncpg://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

Note: URL-encode special characters in the password. `@` → `%40`, `#` → `%23`.

---

### `GEMINI_API_KEY`

| Property | Value |
|----------|-------|
| Required | Yes |
| Format | API key string |
| Default | `""` (empty — AI features fail without this) |

Your Google Gemini API key. Get one at https://aistudio.google.com/app/apikey (free tier available).

```
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Used by `services/gemini.py` to authenticate all Gemini API calls (embeddings, text generation, audio transcription).

---

### `CHAT_MODEL`

| Property | Value |
|----------|-------|
| Required | No |
| Default | `gemini-2.0-flash` |

Gemini model used for text generation and JSON generation. Used for: note structuring, auto-tagging, flashcards, RAG chat, writing assist, expand idea, meeting notes, insights, knowledge gaps.

Other options:
- `gemini-1.5-flash` — faster, slightly less capable
- `gemini-1.5-pro` — more capable, higher latency, higher cost
- `gemini-2.0-flash-exp` — experimental, may change

---

### `EMBEDDING_MODEL`

| Property | Value |
|----------|-------|
| Required | No |
| Default | `models/text-embedding-004` |

Gemini embedding model. Produces 768-dimensional vectors.

The embedding dimension is hardcoded in the database schema (`vector(768)`). Changing to a model with a different dimension requires a database migration.

---

### `CORS_ORIGINS`

| Property | Value |
|----------|-------|
| Required | No |
| Format | JSON array of origin strings |
| Default | `["http://localhost:3000"]` |

Allowed origins for CORS. Must include the frontend URL.

**Development:**
```
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
```

**Production:**
```
CORS_ORIGINS=["https://neuronotes.yourdomain.com"]
```

---

### `RATE_LIMIT`

| Property | Value |
|----------|-------|
| Required | No |
| Format | `"N/period"` |
| Default | `60/minute` |

Global rate limit per IP address. Applied to all API endpoints.

Examples:
```
RATE_LIMIT=60/minute      # 60 requests per minute (default)
RATE_LIMIT=120/minute     # Higher limit for development
RATE_LIMIT=1000/hour      # Hourly limit
RATE_LIMIT=10000/day      # Daily limit
```

Valid periods: `second`, `minute`, `hour`, `day`.

---

## Frontend Variables

Frontend variables are set in `frontend/.env.local`. They must be prefixed with `NEXT_PUBLIC_` to be accessible in browser code.

### `NEXT_PUBLIC_API_URL`

| Property | Value |
|----------|-------|
| Required | Yes |
| Default | `http://localhost:8000` (hardcoded fallback in `lib/api.ts`) |

Base URL of the FastAPI backend. Used by the Axios client in `lib/api.ts`.

**Development:**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Production:**
```
NEXT_PUBLIC_API_URL=https://api.neuronotes.yourdomain.com
```

---

### `NEXT_PUBLIC_SUPABASE_URL`

| Property | Value |
|----------|-------|
| Required | No (optional — for real-time subscriptions) |
| Default | Hardcoded in `lib/supabase.ts` |

Supabase project URL. Format: `https://[PROJECT_REF].supabase.co`.

Only needed if using `lib/supabase.ts` for real-time features. The main API calls go through `NEXT_PUBLIC_API_URL`.

```
NEXT_PUBLIC_SUPABASE_URL=https://mcyppfjrftbczgpuwouu.supabase.co
```

---

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

| Property | Value |
|----------|-------|
| Required | No (optional — for real-time subscriptions) |
| Default | Hardcoded in `lib/supabase.ts` |

Supabase anonymous (public) key. Safe to use in the browser. Found in Supabase dashboard → Settings → API.

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Summary Table

| Variable | Location | Required | Purpose |
|----------|----------|----------|---------|
| `DATABASE_URL` | `backend/.env` | Yes | PostgreSQL connection |
| `GEMINI_API_KEY` | `backend/.env` | Yes | Google Gemini AI |
| `CHAT_MODEL` | `backend/.env` | No | Gemini text model name |
| `EMBEDDING_MODEL` | `backend/.env` | No | Gemini embedding model name |
| `CORS_ORIGINS` | `backend/.env` | No | Allowed frontend origins |
| `RATE_LIMIT` | `backend/.env` | No | Requests per time period |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Recommended | Backend API base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | `frontend/.env.local` | No | Supabase real-time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `frontend/.env.local` | No | Supabase real-time |

---

## `.env.example`

The project root contains `.env.example` with all variables documented:

```bash
# Copy to backend/.env and fill in your values
cp .env.example backend/.env
```

---

## Related Documents

- [Quickstart](quickstart.md)
- [Local Development](local-development.md)
- [Supabase Setup](supabase.md)
- [Production Deployment](../deployment/production.md)

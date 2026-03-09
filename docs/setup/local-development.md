# Local Development Setup

Run the backend and frontend individually without Docker. Useful when you want hot-reload and direct debugging.

## Prerequisites

- **Python 3.12+**
- **Node.js 20+** and npm
- **PostgreSQL 16** with pgvector extension (or use Docker just for Postgres)
- A **Google Gemini API key**

---

## Option A: Docker for Postgres only (recommended)

Run only the database in Docker, and the backend/frontend natively:

```bash
# Start only postgres
docker compose up postgres -d

# Verify it's running
docker compose ps postgres
```

This gives you a local PostgreSQL 16 + pgvector without installing it natively.

---

## Option B: Native PostgreSQL

Install PostgreSQL 16 and pgvector:

```bash
# macOS (Homebrew)
brew install postgresql@16
brew install pgvector  # or compile from source

# Ubuntu
sudo apt install postgresql-16 postgresql-16-pgvector

# Then create the database
createdb neuronotes
psql neuronotes -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

---

## Backend Setup

### 1. Create a virtual environment

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Create `backend/.env`:
```env
DATABASE_URL=postgresql+asyncpg://neuronotes:neuronotes@localhost:5432/neuronotes
GEMINI_API_KEY=your_gemini_api_key_here
CHAT_MODEL=gemini-2.0-flash
EMBEDDING_MODEL=models/text-embedding-004
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
RATE_LIMIT=60/minute
```

If using native PostgreSQL with a different user/password, update `DATABASE_URL` accordingly.

### 4. Start the backend

```bash
uvicorn main:app --reload --port 8000
```

`--reload` enables hot-reload on code changes.

You should see:
```
INFO:     NeuroNotes API starting up…
INFO:     Database tables ready.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

### 5. Verify the backend

```bash
curl http://localhost:8000/health
# {"status": "ok", "service": "NeuroNotes API"}
```

Browse to http://localhost:8000/docs for the interactive API documentation.

---

## Frontend Setup

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment variables

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Start the frontend dev server

```bash
npm run dev
```

The Next.js dev server starts on http://localhost:3000 with hot-reload.

---

## Running Tests

The test suite uses **pytest** with async support (`pytest-asyncio`).

```bash
cd backend
pytest tests/ -v
```

Run a specific test file:
```bash
pytest tests/test_notes.py -v
```

pytest configuration (`backend/pytest.ini`):
```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

`asyncio_mode = auto` automatically handles `async def` test functions without requiring explicit `@pytest.mark.asyncio` decorators.

---

## Useful Development Commands

### Backend

```bash
# Start with auto-reload
uvicorn main:app --reload --port 8000

# Start with SQL echo (see all queries)
DATABASE_URL=... uvicorn main:app --reload --port 8000

# Run type checking (no mypy config currently, use pyright if needed)
# python -m mypy .

# Check imports
python -c "import main"
```

### Frontend

```bash
# Dev server
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build for production
npm run build

# Start production build
npm start
```

---

## Environment Variable Reference

See [Environment Variables](environment-variables.md) for the full list with descriptions.

---

## Connecting to Supabase Instead of Local Postgres

If you want to use Supabase cloud instead of a local database during development:

1. Get your Supabase connection string from the Supabase dashboard
2. Update `DATABASE_URL` in `backend/.env`
3. Run `supabase/schema.sql` in the Supabase SQL editor (one-time setup)
4. Restart the backend

See [Supabase Setup](supabase.md) for full instructions.

---

## Related Documents

- [Quickstart (Docker)](quickstart.md)
- [Environment Variables](environment-variables.md)
- [Testing](../development/testing.md)
- [Supabase Setup](supabase.md)

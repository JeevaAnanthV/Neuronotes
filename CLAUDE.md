# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NeuroNotes is an AI-powered knowledge workspace — a full-stack web application with semantic search, knowledge graphs, and Google Gemini AI. Notes are linked automatically via embedding similarity.

## Development Commands

### Backend (Python/FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
pytest tests/ -v                  # run all tests
pytest tests/test_notes.py -v     # run a single test file
```

### Frontend (Next.js/TypeScript)
```bash
cd frontend
npm install
npm run dev                       # dev server on :3000
npm run build
npm run lint
npx tsc --noEmit                  # type check
```

### Full Stack
```bash
docker compose up -d              # postgres + backend + frontend
```

API docs available at `http://localhost:8000/docs`.

## Environment Variables

```
DATABASE_URL=postgresql+asyncpg://neuronotes:neuronotes@localhost:5432/neuronotes
GEMINI_API_KEY=<your-gemini-api-key>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Architecture

```
Frontend (Next.js 14 @ :3000)
  └─ lib/api.ts (axios client)
       ↓
Backend (FastAPI @ :8000)
  ├─ routers/notes.py    – CRUD; triggers background embedding generation
  ├─ routers/search.py   – semantic search via pgvector cosine similarity
  ├─ routers/ai.py       – all Gemini AI features (structure, tags, flashcards, RAG chat, voice, etc.)
  └─ routers/graph.py    – knowledge graph edges & recomputation
       ↓
Services
  ├─ services/gemini.py  – Gemini API wrapper (embeddings, text generation, audio transcription)
  └─ services/vector.py  – pgvector operations (upsert embeddings, similarity search, link recomputation)
       ↓
PostgreSQL 16 + pgvector
  ├─ notes (content + 768-dim embedding vector)
  ├─ tags / note_tags
  └─ note_links (graph edges with similarity score)
```

### Key Design Patterns

- **Background embedding**: after note create/update, embedding generation runs as a FastAPI `BackgroundTask` (not blocking the response)
- **Knowledge graph links**: `NoteLink` rows are computed from cosine similarity between note embeddings; call `POST /graph/recompute` to rebuild
- **RAG chat**: `/ai/chat` retrieves top-k similar notes via vector search and passes them as context to Gemini
- **Rate limiting**: 60 requests/min globally (slowapi)
- **DB sessions**: SQLAlchemy async sessions via `database.py`; tables are auto-created on startup (no migration needed for fresh installs); Alembic is available for schema changes

### Frontend Structure

- `app/` — Next.js App Router pages (`/`, `/notes/[id]`, `/graph`, `/chat`)
- `components/` — UI components; `Editor.tsx` uses TipTap with slash commands and AI toolbar
- `lib/api.ts` — typed Axios client; all backend calls go through here

### Backend Module Responsibilities

| File | Responsibility |
|------|---------------|
| `main.py` | App setup, CORS, rate limiting, lifespan (DB init) |
| `config.py` | Pydantic settings (reads env vars) |
| `models.py` | SQLAlchemy ORM: Note, Tag, NoteTag, NoteLink |
| `schemas.py` | Pydantic request/response models |
| `services/gemini.py` | All Gemini API calls |
| `services/vector.py` | pgvector similarity search & embedding upsert |

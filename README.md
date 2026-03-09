# NeuroNotes

> Your AI-powered knowledge workspace — where notes become intelligence.

![CI](https://github.com/JeevaAnanthV/Neuronotes/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.12-green)
![Next.js](https://img.shields.io/badge/Next.js-14-black)

---

## What Makes NeuroNotes Different

NeuroNotes is not a notes app. It is a **thinking system** — built for engineers, researchers, and product leaders who need their notes to connect, evolve, and think alongside them.

### Core Intelligence Features

- **Semantic Knowledge Graph** — notes auto-connect based on meaning, not keywords, using pgvector cosine similarity
- **RAG-Powered AI Chat** — ask questions, get answers grounded in YOUR notes with source citations
- **Auto-Tagging** — Gemini AI reads your note and tags it instantly with relevant topic tags
- **Smart Flashcards** — turn any note into study material with one click
- **AI Insights Dashboard** — see your thinking patterns, knowledge gaps, and topic evolution
- **Voice Notes** — speak your thoughts, get structured notes back via Gemini multimodal
- **Slash Commands** — `/summarize`, `/expand`, `/research`, `/structure` inline in the editor
- **Writing Assistant** — improve, rewrite, expand, or bullet-ify any selection
- **Knowledge Gap Detection** — AI identifies concepts you have not covered yet
- **Magic Link Auth** — passwordless, secure sign-in via Supabase Auth

### New Competition Features (v2)

- **Collaborative Notes** — Supabase Realtime presence shows other viewers; live toast when note is updated by another user
- **AI Writing Coach** — inline ghost suggestions appear after 2s of typing 50+ chars; Tab to accept, Esc to dismiss
- **Spaced Repetition (SM-2)** — flashcard study mode at `/flashcards` with Again/Hard/Good/Easy ratings and SM-2 scheduling stored in localStorage
- **Note Templates** — 6 pre-built templates (Meeting, Research, Journal, Idea, Book, Blank) via modal on "+ New Note"
- **Cross-Note Q&A** — dedicated page at `/qa`; pin specific notes as context or ask across all notes; sources shown per answer
- **Smart Reminders** — AI extracts action items from note content; Google Calendar integration; aggregated view at `/reminders`
- **Topic Clustering** — visual card grid at `/clusters` grouping notes by tag; filterable by topic

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, TailwindCSS, TipTap, React Flow |
| Backend | FastAPI, Python 3.12, Supabase-py |
| Database | Supabase (PostgreSQL 16 + pgvector) |
| AI | Google Gemini 2.5 Flash (embeddings + generation) |
| Auth | Supabase Auth (Magic Link OTP) |
| CI/CD | GitHub Actions (test + lint + docker build) |

---

## Architecture

```
Browser (Next.js 14 @ :3000)
  └─ lib/api.ts (Axios typed client)
       ↓ HTTP/REST
Backend (FastAPI @ :8001)
  ├─ routers/notes.py    — CRUD; background embedding generation
  ├─ routers/search.py   — semantic search via pgvector cosine similarity
  ├─ routers/ai.py       — Gemini: tags, flashcards, RAG chat, voice, insights
  └─ routers/graph.py    — knowledge graph edges & recompute
       ↓
Services
  ├─ services/gemini.py  — Gemini API wrapper (embed, generate, transcribe)
  └─ services/vector.py  — pgvector upsert, similarity search, link recompute
       ↓
Supabase (PostgreSQL 16 + pgvector)
  ├─ notes       (content + 768-dim embedding vector)
  ├─ tags / note_tags
  └─ note_links  (graph edges with similarity score)
```

### Key Design Decisions

- **Background embedding**: after note create/update, embedding generation runs as a FastAPI `BackgroundTask` (non-blocking — note is returned immediately)
- **Knowledge graph links**: `note_links` rows are computed from cosine similarity; `POST /graph/recompute` rebuilds the full graph
- **RAG chat**: `/ai/chat` retrieves top-k similar notes via vector search and passes them as context to Gemini
- **No migration required**: tables are created via Supabase dashboard + SQL migrations in `/supabase`

---

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.12+
- Docker (optional, for full-stack)
- A [Supabase](https://supabase.com) project with pgvector enabled
- A [Gemini API key](https://aistudio.google.com)

### 1. Clone

```bash
git clone https://github.com/JeevaAnanthV/Neuronotes.git
cd neuronotes
```

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
```

### 3. Start Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 4. Start Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8001 npm run dev
```

### Full Stack with Docker

```bash
docker compose up -d
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- API Docs: http://localhost:8001/docs

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `CHAT_MODEL` | Gemini model for chat (default: `gemini-2.5-flash`) | No |
| `EMBEDDING_MODEL` | Gemini embedding model (default: `gemini-embedding-001`) | No |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:8001`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

---

## API Documentation

Interactive Swagger UI available at `http://localhost:8001/docs` when the backend is running.

Key endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notes/` | List all notes |
| POST | `/notes/` | Create note |
| PUT | `/notes/{id}` | Update note |
| DELETE | `/notes/{id}` | Delete note |
| POST | `/notes/{id}/tags/{name}` | Add tag to note |
| GET | `/search/?q=...` | Semantic search |
| POST | `/ai/tags` | Generate tags for content |
| POST | `/ai/flashcards` | Generate flashcards |
| POST | `/ai/chat` | RAG chat with notes |
| GET | `/ai/insights` | AI insights dashboard |
| POST | `/ai/voice` | Transcribe voice note |
| GET | `/graph/` | Knowledge graph data |
| POST | `/graph/recompute` | Rebuild knowledge graph |

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

Tests are fully mocked — no Supabase or Gemini credentials required. 40 tests cover CRUD, AI, and search endpoints.

---

## CI/CD Pipeline

GitHub Actions runs on every push to `main` and `develop`:

1. **Backend Tests** — `pytest tests/ -v` with mocked external services
2. **Frontend Type Check** — `npx tsc --noEmit`
3. **Frontend Lint** — `npm run lint`
4. **Docker Build** — builds both `neuronotes-backend` and `neuronotes-frontend` images

See `.github/workflows/ci.yml`.

---

## Screenshots

| Dashboard | Editor | Knowledge Graph |
|-----------|--------|----------------|
| Note list with AI insights, quick search, and analytics summary | TipTap rich editor with ghost AI suggestions, slash commands, and selection toolbar | Interactive React Flow graph with semantic edges and tag filtering |

| Flashcards | AI Chat | Topic Clusters |
|-----------|---------|----------------|
| SM-2 spaced repetition study mode with Again/Hard/Good/Easy ratings | RAG-powered chat grounded in your notes with source citations | Visual card grid grouping notes by AI-detected topic |

> Clone and run locally — the full stack is up in under 5 minutes with the Quick Start guide above.

---

## Competition Notes

Built for the Note-Taking Application Challenge. Demonstrates:

- **Production-grade CI/CD pipeline** — GitHub Actions with test, lint, type-check, and Docker build gates
- **AI-first architecture** — every core feature (tagging, linking, chat, flashcards) is powered by Gemini
- **Semantic search** — pgvector cosine similarity, not keyword matching
- **Cloud-native design** — Supabase for DB + auth, Vercel-ready frontend, Railway-ready backend
- **End-to-end type safety** — TypeScript frontend + Pydantic backend schemas
- **Comprehensive test suite** — 40 pytest tests, zero external API calls during CI
- **Real-time collaboration** — Supabase Realtime presence and postgres_changes subscriptions
- **Spaced repetition learning** — SM-2 algorithm implementation for long-term knowledge retention
- **7 advanced features** added for competition: Collaborative Notes, AI Writing Coach, Spaced Repetition, Note Templates, Cross-Note Q&A, Smart Reminders, Topic Clustering

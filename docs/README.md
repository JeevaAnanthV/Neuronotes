# NeuroNotes Documentation

NeuroNotes is an AI-powered knowledge workspace that transforms your notes into an intelligent, interconnected network. It combines semantic search, a knowledge graph, and Google Gemini AI to help you capture, connect, and explore ideas.

---

## Table of Contents

### Architecture
| Document | Description |
|----------|-------------|
| [architecture/overview.md](architecture/overview.md) | High-level system design, tech stack, component diagram, design decisions |
| [architecture/backend.md](architecture/backend.md) | FastAPI deep dive: middleware, routers, lifespan, async patterns |
| [architecture/frontend.md](architecture/frontend.md) | Next.js 14 App Router structure, component hierarchy, state management |
| [architecture/database.md](architecture/database.md) | PostgreSQL schema, pgvector indexes, relationships, Supabase setup |
| [architecture/ai.md](architecture/ai.md) | Gemini API integration, embeddings, RAG pipeline, all AI features |

### Data Flows
| Document | Description |
|----------|-------------|
| [dataflow/note-creation.md](dataflow/note-creation.md) | Full flow: form submit → DB insert → background embedding → graph update |
| [dataflow/semantic-search.md](dataflow/semantic-search.md) | Query → embedding → cosine similarity → ranked results |
| [dataflow/rag-chat.md](dataflow/rag-chat.md) | User question → vector retrieval → Gemini prompt → cited response |
| [dataflow/knowledge-graph.md](dataflow/knowledge-graph.md) | Embeddings → pairwise similarity → NoteLink rows → React Flow |

### Features
| Document | Description |
|----------|-------------|
| [features/notes.md](features/notes.md) | CRUD, autosave, TipTap editor, slash commands |
| [features/ai.md](features/ai.md) | All AI features: summarize, tag, flashcards, voice, expand, research |
| [features/knowledge-graph.md](features/knowledge-graph.md) | Graph page, React Flow, node/edge design, filtering |
| [features/search.md](features/search.md) | Semantic search, command palette, ranking |
| [features/insights.md](features/insights.md) | AI insights page, knowledge gaps, topic distribution |

### API Reference
| Document | Description |
|----------|-------------|
| [api/overview.md](api/overview.md) | API conventions, base URL, rate limiting, error format |
| [api/notes.md](api/notes.md) | /notes endpoints — CRUD + tag management |
| [api/search.md](api/search.md) | /search endpoint — semantic search |
| [api/ai.md](api/ai.md) | /ai/* endpoints — all AI features |
| [api/graph.md](api/graph.md) | /graph endpoints — graph data and recompute |

### Setup
| Document | Description |
|----------|-------------|
| [setup/quickstart.md](setup/quickstart.md) | Get running in 5 minutes with Docker |
| [setup/local-development.md](setup/local-development.md) | Full local dev setup without Docker |
| [setup/supabase.md](setup/supabase.md) | Connect to Supabase cloud database |
| [setup/environment-variables.md](setup/environment-variables.md) | Every environment variable documented |

### Development
| Document | Description |
|----------|-------------|
| [development/project-structure.md](development/project-structure.md) | Annotated file tree of the entire project |
| [development/contributing.md](development/contributing.md) | Code style, adding endpoints, adding pages, PR process |
| [development/testing.md](development/testing.md) | Running tests, pytest setup, async test patterns |

### Deployment
| Document | Description |
|----------|-------------|
| [deployment/docker.md](deployment/docker.md) | Docker Compose services, volumes, networking |
| [deployment/production.md](deployment/production.md) | Production checklist, security, recommended hosting |

---

## Quick Links

- **API docs (interactive):** http://localhost:8000/docs (when running locally)
- **Health check:** http://localhost:8000/health
- **Frontend:** http://localhost:3000

## Tech Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, TipTap, React Flow |
| Backend | FastAPI, Python 3.12, SQLAlchemy async, slowapi |
| Database | PostgreSQL 16 + pgvector |
| AI | Google Gemini 2.0 Flash (chat), text-embedding-004 (768-dim vectors) |
| Infrastructure | Docker Compose, Supabase (cloud option) |

# Project Structure

Annotated file tree of the entire NeuroNotes project.

```
neuronotes/                         ← project root
├── .env.example                    ← template for all environment variables
├── docker-compose.yml              ← defines postgres + backend + frontend services
├── CLAUDE.md                       ← project instructions for Claude Code
│
├── backend/                        ← Python FastAPI application
│   ├── .env                        ← backend environment variables (not committed)
│   ├── Dockerfile                  ← python:3.12-slim, installs deps, runs uvicorn
│   ├── pytest.ini                  ← asyncio_mode = auto, testpaths = tests
│   ├── requirements.txt            ← Python dependencies
│   │
│   ├── main.py                     ← FastAPI app factory, middleware, router registration
│   │                                  • lifespan: create_all on startup, dispose on shutdown
│   │                                  • slowapi rate limiter (60/min by IP)
│   │                                  • CORSMiddleware (origins from CORS_ORIGINS env)
│   │                                  • request_id_and_logging middleware
│   │                                  • X-Request-ID header on all responses
│   │                                  • GET /health endpoint
│   │
│   ├── config.py                   ← Pydantic settings (reads from .env file)
│   │                                  • database_url, gemini_api_key
│   │                                  • embedding_model, chat_model
│   │                                  • cors_origins, rate_limit
│   │                                  • @lru_cache for singleton settings
│   │
│   ├── database.py                 ← SQLAlchemy async engine and session factory
│   │                                  • create_async_engine with pool_pre_ping
│   │                                  • AsyncSessionLocal (expire_on_commit=False)
│   │                                  • Base = DeclarativeBase()
│   │                                  • get_db() async generator (FastAPI dependency)
│   │
│   ├── models.py                   ← SQLAlchemy ORM models
│   │                                  • Tag: id, name (unique)
│   │                                  • Note: id, title, content, created_at, updated_at,
│   │                                          embedding Vector(768)
│   │                                  • NoteTag: note_id FK, tag_id FK (junction)
│   │                                  • NoteLink: source_id FK, target_id FK, similarity
│   │
│   ├── schemas.py                  ← Pydantic request/response models
│   │                                  • TagBase, TagCreate, TagRead, TagWithCount
│   │                                  • NoteBase, NoteCreate, NoteUpdate, NoteRead, NoteListItem
│   │                                  • SearchResult
│   │                                  • GraphNode, GraphEdge, GraphData
│   │                                  • StructureRequest/Response
│   │                                  • TagsRequest/Response
│   │                                  • FlashcardsRequest/Response, Flashcard
│   │                                  • ChatMessage, ChatRequest, ChatResponse
│   │                                  • WritingAssistRequest/Response
│   │                                  • ExpandIdeaRequest/Response
│   │                                  • MeetingNotesRequest/Response
│   │                                  • InsightsResponse
│   │                                  • VoiceNoteResponse
│   │                                  • GapsResponse, LinkSuggestionsResponse
│   │                                  • ResearchRequest/Response
│   │
│   ├── routers/                    ← FastAPI route modules
│   │   ├── __init__.py
│   │   ├── notes.py                ← CRUD for notes + tag management
│   │   │                              • GET /notes/ — list all (by updated_at desc)
│   │   │                              • POST /notes/ — create, schedules embedding task
│   │   │                              • GET /notes/{id} — get single note
│   │   │                              • PUT /notes/{id} — partial update, reschedules embedding
│   │   │                              • DELETE /notes/{id} — delete (cascades)
│   │   │                              • POST /notes/{id}/tags/{name} — add tag (get-or-create)
│   │   │                              • DELETE /notes/{id}/tags/{name} — remove tag
│   │   │                              • _embed_and_link() background task
│   │   │
│   │   ├── search.py               ← Semantic search
│   │   │                              • GET /search/?q=...&top_k=8
│   │   │                              • embeds query → cosine similarity → bulk fetch
│   │   │
│   │   ├── ai.py                   ← All Gemini AI endpoints
│   │   │                              • POST /ai/structure
│   │   │                              • POST /ai/tags
│   │   │                              • POST /ai/flashcards
│   │   │                              • POST /ai/chat (RAG)
│   │   │                              • POST /ai/writing-assist
│   │   │                              • POST /ai/expand-idea
│   │   │                              • POST /ai/meeting-notes
│   │   │                              • GET /ai/insights
│   │   │                              • POST /ai/voice (multipart)
│   │   │                              • GET /ai/gaps
│   │   │                              • GET /ai/link-suggestions/{note_id}
│   │   │                              • POST /ai/research
│   │   │
│   │   ├── graph.py                ← Knowledge graph
│   │   │                              • GET /graph/ — all nodes and edges
│   │   │                              • POST /graph/recompute?threshold=0.72
│   │   │
│   │   └── tags.py                 ← Tag listing
│   │                                  • GET /tags/ — all tags with note counts
│   │
│   └── services/                   ← External service wrappers
│       ├── __init__.py
│       ├── gemini.py               ← Google Gemini API wrapper
│       │                              • embed_text() — 768-dim embeddings via to_thread
│       │                              • generate() — text generation via to_thread
│       │                              • generate_json() — JSON generation with fence stripping
│       │                              • transcribe_audio() — gemini-1.5-flash multimodal
│       │
│       └── vector.py               ← pgvector SQL operations
│                                      • upsert_embedding() — UPDATE notes SET embedding
│                                      • similarity_search() — cosine similarity query
│                                      • recompute_all_links() — full graph rebuild
│                                      • recompute_links_for_note() — incremental per-note
│
├── frontend/                       ← Next.js 16 application
│   ├── .env.local                  ← frontend env vars (not committed)
│   ├── Dockerfile                  ← multi-stage: builder (npm build) + runner (node)
│   ├── package.json                ← dependencies: next, react, tiptap, reactflow, axios, etc.
│   ├── tsconfig.json               ← TypeScript config with @/ path alias
│   │
│   ├── app/                        ← Next.js App Router pages
│   │   ├── layout.tsx              ← Root layout: Sidebar + MobileNav + FloatingAI
│   │   ├── globals.css             ← CSS variables, global styles, component classes
│   │   ├── page.tsx                ← Dashboard (/) — recent notes + AI insights + graph preview
│   │   ├── chat/
│   │   │   └── page.tsx            ← AI Chat page (/chat) — wraps AIChat component
│   │   ├── graph/
│   │   │   └── page.tsx            ← Knowledge Graph page (/graph) — wraps KnowledgeGraph
│   │   ├── insights/
│   │   │   └── page.tsx            ← AI Insights page (/insights) — full analytics view
│   │   ├── notes/
│   │   │   └── [id]/
│   │   │       └── page.tsx        ← Note editor (/notes/:id)
│   │   │                              • autosave (1500ms debounce)
│   │   │                              • slash command handling
│   │   │                              • Editor + DailyInsights + ContextPanel + VoiceRecorder
│   │   ├── settings/
│   │   │   └── page.tsx            ← Settings (/settings) — rebuild graph, keyboard shortcuts
│   │   └── tags/
│   │       └── page.tsx            ← Tags browser (/tags) — tag cloud + filtered notes
│   │
│   ├── components/                 ← Reusable UI components
│   │   ├── AIChat.tsx              ← Full-page RAG chat interface
│   │   │                              • multi-turn conversation state
│   │   │                              • source note citations
│   │   │
│   │   ├── CommandPalette.tsx      ← Global search/command overlay (Ctrl+K)
│   │   │                              • 300ms debounce semantic search
│   │   │                              • quick-action items
│   │   │                              • keyboard navigation (↑↓↵esc)
│   │   │                              • fallback to title substring match
│   │   │
│   │   ├── ContextPanel.tsx        ← Right sidebar on note pages
│   │   │                              • AI Insights section
│   │   │                              • AI Actions (Auto Tags, Flashcards, Expand Idea)
│   │   │                              • Generated tags with removal
│   │   │                              • FlashcardViewer
│   │   │                              • Expanded Ideas list
│   │   │                              • Related Notes (auto-search, 2s delay)
│   │   │                              • Connections (link suggestions)
│   │   │                              • Knowledge Gaps
│   │   │                              • Keyboard shortcuts reference
│   │   │
│   │   ├── DailyInsights.tsx       ← Dismissible AI insight banner in note editor
│   │   │
│   │   ├── Editor.tsx              ← TipTap rich-text editor
│   │   │                              • StarterKit + Placeholder extensions
│   │   │                              • AI toolbar on text selection (10+ chars)
│   │   │                              • Slash command menu on "/" keypress
│   │   │                              • 3s AI hint after inactivity
│   │   │
│   │   ├── FlashcardViewer.tsx     ← Flip-card flashcard component
│   │   │                              • one card at a time with prev/next
│   │   │                              • 3D CSS flip animation
│   │   │
│   │   ├── FloatingAI.tsx          ← Floating AI assistant (bottom-right, all pages)
│   │   │                              • sparkle button toggle
│   │   │                              • slide-in chat panel
│   │   │                              • same RAG backend as /chat
│   │   │                              • no source citations (simplified)
│   │   │
│   │   ├── KnowledgeGraph.tsx      ← React Flow graph visualization
│   │   │                              • circular node layout
│   │   │                              • edge visual encoding (opacity, width, animation)
│   │   │                              • hover tooltips + glow effect
│   │   │                              • search highlighting
│   │   │                              • tag filtering
│   │   │                              • rebuild + refresh buttons
│   │   │
│   │   ├── MobileNav.tsx           ← Bottom navigation bar (mobile only)
│   │   │                              • Notes, Search, AI Chat, Graph
│   │   │                              • Search opens CommandPalette
│   │   │
│   │   ├── Sidebar.tsx             ← Left sidebar navigation
│   │   │                              • collapse/expand (Ctrl+[)
│   │   │                              • New Note button (Ctrl+N)
│   │   │                              • Navigation: Notes, Tags, Graph, Chat, Insights
│   │   │                              • Search button (opens CommandPalette, Ctrl+K)
│   │   │                              • Recent notes list (10 items, polls every 10s)
│   │   │                              • Mobile: hamburger + slide-in overlay
│   │   │
│   │   └── VoiceRecorder.tsx       ← Browser MediaRecorder + voice note processing
│   │                                  • audio/webm recording
│   │                                  • POST /ai/voice multipart upload
│   │                                  • updates current note with structured content
│   │
│   └── lib/
│       ├── api.ts                  ← Typed Axios client
│       │                              • api = axios.create({baseURL})
│       │                              • notesApi, tagsApi, searchApi, aiApi, graphApi
│       │                              • all TypeScript types for request/response
│       │
│       └── supabase.ts             ← Supabase JS client (optional, real-time)
│                                      • createClient with project URL + anon key
│                                      • subscribeToNotes() helper
│                                      • SupabaseNote, SupabaseTag type helpers
│
└── supabase/
    └── schema.sql                  ← SQL to apply to Supabase or fresh PostgreSQL
                                       • CREATE EXTENSION vector
                                       • CREATE TABLE notes, tags, note_tags, note_links
                                       • IVFFlat index on notes.embedding
                                       • update_updated_at trigger
```

---

## Related Documents

- [Architecture Overview](../architecture/overview.md)
- [Backend Architecture](../architecture/backend.md)
- [Frontend Architecture](../architecture/frontend.md)

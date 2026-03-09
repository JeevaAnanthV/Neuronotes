# Frontend Architecture

The NeuroNotes frontend is a Next.js 16 application using the App Router. It is entirely client-side rendered — all data is fetched from the FastAPI backend at runtime. TypeScript is used throughout.

## Table of Contents
- [File Structure](#file-structure)
- [App Router Pages](#app-router-pages)
- [Component Hierarchy](#component-hierarchy)
- [API Client](#api-client)
- [State Management](#state-management)
- [Design System](#design-system)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Mobile Support](#mobile-support)

---

## File Structure

```
frontend/
├── app/
│   ├── layout.tsx          — Root layout (Sidebar + MobileNav + FloatingAI)
│   ├── globals.css         — CSS variables, global styles, component classes
│   ├── page.tsx            — Dashboard (/)
│   ├── chat/
│   │   └── page.tsx        — AI Chat page (/chat)
│   ├── graph/
│   │   └── page.tsx        — Knowledge Graph page (/graph)
│   ├── insights/
│   │   └── page.tsx        — AI Insights page (/insights)
│   ├── notes/
│   │   └── [id]/
│   │       └── page.tsx    — Note editor page (/notes/:id)
│   ├── settings/
│   │   └── page.tsx        — Settings page (/settings)
│   └── tags/
│       └── page.tsx        — Tags browser page (/tags)
├── components/
│   ├── AIChat.tsx          — Full-page RAG chat interface
│   ├── CommandPalette.tsx  — Global search/command overlay (Ctrl+K)
│   ├── ContextPanel.tsx    — Right panel on note pages
│   ├── DailyInsights.tsx   — AI insight banner shown in note editor
│   ├── Editor.tsx          — TipTap rich-text editor with AI features
│   ├── FlashcardViewer.tsx — Flip-card flashcard component
│   ├── FloatingAI.tsx      — Floating AI assistant button + chat panel
│   ├── KnowledgeGraph.tsx  — React Flow graph visualization
│   ├── MobileNav.tsx       — Bottom nav bar (mobile only)
│   ├── Sidebar.tsx         — Left sidebar with navigation and note list
│   └── VoiceRecorder.tsx   — Browser MediaRecorder + voice note processing
├── lib/
│   ├── api.ts              — Typed Axios client for all backend calls
│   └── supabase.ts         — Supabase JS client (optional, for real-time)
├── package.json
├── tsconfig.json
├── Dockerfile              — Multi-stage: builder (npm build) + runner (node)
└── .env.local              — NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_*
```

---

## App Router Pages

All pages use `"use client"` because they fetch data via client-side effects.

### `/` — Dashboard (`app/page.tsx`)
Loads `notesApi.list()` and `aiApi.insights()` in parallel via `Promise.all`. Renders:
- "Continue Writing" banner linking to the most recently updated note
- 3-card grid: Recent Notes, AI Insights, Knowledge Map preview

### `/notes/[id]` — Note Editor (`app/notes/[id]/page.tsx`)
The main editing interface. Key behaviors:
- Fetches note on mount via `notesApi.get(id)`
- **Autosave**: 1500ms debounce on every content/title change (`AUTOSAVE_DELAY = 1500`)
- Renders `Editor` (TipTap), `DailyInsights` banner, `ContextPanel`, `VoiceRecorder`
- Slash commands (`/summarize`, `/expand`, `/research`, `/structure`) are handled inline
- `flashcards` and `tags` slash commands are delegated to the ContextPanel

### `/graph` — Knowledge Graph (`app/graph/page.tsx`)
Thin wrapper around the `KnowledgeGraph` component. The page provides the header bar; all graph logic is in the component.

### `/chat` — AI Chat (`app/chat/page.tsx`)
Thin wrapper around the `AIChat` component. The page provides a flex container; chat logic is in the component.

### `/insights` — AI Insights (`app/insights/page.tsx`)
Loads four data sources in parallel: `aiApi.insights()`, `aiApi.gaps()`, `tagsApi.list()`, `notesApi.list()`. Renders:
- AI summary card
- Stats row (total notes, this week, unfinished ideas, top topic)
- Knowledge Overview: tag distribution progress bars
- Learning Progress: 14-day bar chart of note creation
- Knowledge Gaps: topics to explore
- Suggested Exploration topics
- Recent Activity timeline

### `/tags` — Tags Browser (`app/tags/page.tsx`)
Loads all tags with counts plus all notes. Renders a tag cloud with font-size scaling by count. Clicking a tag filters notes by that tag.

### `/settings` — Settings (`app/settings/page.tsx`)
Shows app version, backend URL, AI model info. Provides a "Rebuild Knowledge Graph" button that calls `graphApi.recompute(0.72)`. Lists keyboard shortcuts.

---

## Component Hierarchy

```
RootLayout (app/layout.tsx)
├── Sidebar
│   └── CommandPalette (conditional, Ctrl+K)
├── <page content>        ← { children }
│   ├── DashboardPage (/)
│   ├── NotePage (/notes/[id])
│   │   ├── DailyInsights
│   │   ├── Editor
│   │   │   ├── AIToolbar (conditional, on text selection)
│   │   │   └── SlashMenu (conditional, on "/" keypress)
│   │   ├── VoiceRecorder
│   │   └── ContextPanel
│   │       └── FlashcardViewer (conditional)
│   ├── GraphPage (/graph)
│   │   └── KnowledgeGraph
│   ├── ChatPage (/chat)
│   │   └── AIChat
│   ├── InsightsPage (/insights)
│   ├── TagsPage (/tags)
│   └── SettingsPage (/settings)
├── MobileNav
└── FloatingAI
```

---

## API Client

`lib/api.ts` is the single module for all backend communication. It creates an Axios instance:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
    baseURL: API_BASE,
    headers: { "Content-Type": "application/json" },
});
```

Five typed API objects are exported:

| Export | Endpoints |
|--------|-----------|
| `notesApi` | list, get, create, update, delete, addTag, removeTag |
| `tagsApi` | list |
| `searchApi` | semantic |
| `aiApi` | structure, generateTags, flashcards, chat, writingAssist, expandIdea, meetingNotes, insights, voice, gaps, linkSuggestions, research |
| `graphApi` | get, recompute |

Voice notes use `multipart/form-data` with a `FormData` object and override the content type header:
```typescript
aiApi.voice: (formData: FormData) =>
    api.post("/ai/voice", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    })
```

---

## State Management

There is no global state library (no Redux, no Zustand). State is managed with React `useState` and `useEffect` per component.

**Pattern used everywhere:**
```typescript
const [data, setData] = useState<Type | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
    someApi.call()
        .then(setData)
        .catch(() => {})   // graceful degradation on network errors
        .finally(() => setLoading(false));
}, []);
```

**Sidebar polling:** The sidebar fetches the notes list every 10 seconds using `setInterval` to stay fresh after notes are created/deleted from other pages:
```typescript
// frontend/components/Sidebar.tsx:58-62
useEffect(() => {
    loadNotes();
    const interval = setInterval(loadNotes, 10000);
    return () => clearInterval(interval);
}, [loadNotes]);
```

**Autosave debouncing:** Note pages use `useRef` to hold the timer so it persists across renders:
```typescript
const saveTimer = useRef<ReturnType<typeof setTimeout>>();
const scheduleSave = (newTitle, newContent) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(newTitle, newContent), 1500);
};
```

**Context panel lazy loading:** The ContextPanel triggers related note search after a 2-second delay following content changes, throttling search API calls:
```typescript
// frontend/components/ContextPanel.tsx:86-94
useEffect(() => {
    if (!content || content.length < 20) return;
    const timer = setTimeout(async () => {
        const results = await searchApi.semantic(content.slice(0, 200), 4);
        setRelated(results.filter(r => r.note.id !== noteId).slice(0, 3).map(r => r.note));
    }, 2000);
    return () => clearTimeout(timer);
}, [content, noteId]);
```

---

## Design System

The design system is CSS-variable based. Variables are defined in `app/globals.css` and used inline in component `style` props (not Tailwind utility classes — the design system predates the Tailwind integration).

Key CSS variables:

| Variable | Use |
|----------|-----|
| `--bg-primary` | Page background |
| `--bg-elevated` | Card/panel backgrounds |
| `--bg-tertiary` | Input/badge backgrounds |
| `--bg-hover` | Hover state backgrounds |
| `--accent-primary` | Primary accent color (indigo #6366F1) |
| `--accent-dim` | Low-opacity accent for backgrounds |
| `--accent-gradient` | Gradient for AI badges |
| `--text-primary` | Primary text |
| `--text-secondary` | Secondary/subdued text |
| `--text-muted` | Placeholder/timestamp text |
| `--border` | Standard border |
| `--border-light` | Lighter borders |
| `--success` | Success green |
| `--warning` | Warning amber |
| `--danger` | Danger red |
| `--radius-sm/md/lg` | Border radius scale |
| `--shadow-sm/md` | Box shadow scale |

Reusable CSS classes defined in `globals.css` include: `btn`, `btn-primary`, `btn-ghost`, `btn-sm`, `btn-icon`, `sidebar`, `nav-item`, `note-item`, `editor-shell`, `context-panel`, `chat-shell`, `flashcard`, `ai-toolbar`, `palette-overlay`, `floating-ai-btn`, `loading-spinner`.

The font is **Inter** loaded from Google Fonts with weights 300, 400, 500, 600, 700.

---

## Keyboard Shortcuts

Registered globally in `Sidebar.tsx`:

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` / `Cmd+K` | Open command palette |
| `Ctrl+N` / `Cmd+N` | Create new note |
| `Ctrl+[` / `Cmd+[` | Toggle sidebar collapse |

Registered in `Editor.tsx` (within editor context):

| Shortcut | Action |
|----------|--------|
| `/` | Open slash command menu |
| `Arrow Up/Down` | Navigate slash menu |
| `Enter` | Select slash command |
| `Escape` | Dismiss slash menu |

Registered in `CommandPalette.tsx`:

| Shortcut | Action |
|----------|--------|
| `Arrow Up/Down` | Navigate results |
| `Enter` | Select item |
| `Escape` | Close palette |

Registered in `FloatingAI.tsx`:

| Shortcut | Action |
|----------|--------|
| `Escape` | Close floating AI panel |

---

## Mobile Support

The layout adapts for mobile screens:

- **`MobileNav`** — Fixed bottom navigation bar with icons for Notes, Search, AI Chat, and Graph. Visible only on mobile (CSS `display: none` on desktop).
- **`Sidebar`** — Has two modes: desktop (permanent left sidebar) and mobile (slide-in overlay triggered by hamburger button at top-left).
- **Hamburger button** — Fixed at `top: 12px, left: 12px` on mobile, z-index 900.
- **Mobile overlay** — Semi-transparent backdrop behind the mobile sidebar. Clicking it closes the sidebar.

---

## Related Documents

- [Architecture Overview](overview.md)
- [Backend Architecture](backend.md)
- [Features: Notes](../features/notes.md)
- [Features: Knowledge Graph](../features/knowledge-graph.md)

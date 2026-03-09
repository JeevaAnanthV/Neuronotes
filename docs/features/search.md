# Feature: Search

NeuroNotes uses semantic search powered by vector embeddings. Search understands meaning, not just keywords — a query for "productivity techniques" finds notes about "GTD" and "time management" even without those words appearing in the query.

## Table of Contents
- [Command Palette](#command-palette)
- [How Semantic Search Works](#how-semantic-search-works)
- [Search Fallback](#search-fallback)
- [Result Display](#result-display)
- [Related Notes (Auto-search)](#related-notes-auto-search)
- [Limitations](#limitations)

---

## Command Palette

The primary search interface. Opens with `Ctrl+K` (or `Cmd+K` on Mac) from anywhere in the application.

```
┌────────────────────────────────────────────────────┐
│  🔍 Search notes, run commands…                    │
├────────────────────────────────────────────────────┤
│  ACTIONS                                           │
│  ┌─────┐  Create new note                          │
│  │  +  │  Start a blank note                       │
│  └─────┘                                           │
│  ┌─────┐  Open Knowledge Graph                     │
│  │  ◈  │  Visualise note connections               │
│  └─────┘                                           │
│  ...                                               │
├────────────────────────────────────────────────────┤
│  RECENT NOTES                                      │
│  ┌─────┐  Machine Learning Fundamentals            │
│  │  📄 │  #ml #ai                                  │
│  └─────┘                                           │
│  ...                                               │
├────────────────────────────────────────────────────┤
│  ↑↓ navigate  ↵ select  esc close                  │
└────────────────────────────────────────────────────┘
```

### Behavior when empty
Shows 5 quick-action items and the 6 most recently updated notes.

### Behavior when typing
- 300ms debounce before sending the search request
- Semantic search results replace the notes list
- Actions list is filtered by label/description substring match
- Similarity scores shown as percentage badges (e.g., `87%`) on results

### Navigation
- Arrow keys to navigate the combined list (actions + notes)
- Enter to select
- Escape to close
- Click any item to select

### Quick actions
| Action | Description |
|--------|-------------|
| Create new note | Creates blank note and navigates |
| Open Knowledge Graph | Navigates to `/graph` |
| AI Chat | Navigates to `/chat` |
| View AI Insights | Navigates to `/insights` |
| Browse Tags | Navigates to `/tags` |

---

## How Semantic Search Works

When the user types a query:

1. `searchApi.semantic(query, 8)` sends `GET /search/?q={query}&top_k=8`
2. Backend embeds the query using `gemini.embed_text(q)` → 768-dim vector
3. pgvector computes cosine similarity: `1 - (embedding <=> query_vector)` for each note
4. Top 8 results ordered by similarity are returned
5. Frontend renders results with title, tags, and similarity badge

The embedding comparison captures semantic meaning. Examples:
- "how to focus" → finds notes about "concentration", "deep work", "distraction management"
- "python" → finds notes about programming, automation, data science
- "today's meeting" → finds meeting note from today

---

## Search Fallback

If the backend is unavailable, the command palette falls back to client-side title substring matching:
```typescript
// frontend/components/CommandPalette.tsx:93-97
const filtered = allNotes
    .filter(n => n.title.toLowerCase().includes(query.toLowerCase()))
    .map(n => ({ note: n, score: 1 }));
setResults(filtered);
```
Results show with score `1.0` (no percentage badge in this mode) and are not ranked by relevance.

---

## Result Display

Each search result in the command palette shows:
- Document icon
- Note title
- Tags (as `#tag-name` format)
- Similarity percentage badge (when score < 1.0)

Clicking any result navigates to `/notes/{id}` and closes the palette.

---

## Related Notes (Auto-search)

When editing a note, the ContextPanel automatically finds related notes using a background search. This happens 2 seconds after any content change, using the first 200 characters of the note:

```typescript
// frontend/components/ContextPanel.tsx:86-94
const timer = setTimeout(async () => {
    const results = await searchApi.semantic(content.slice(0, 200), 4);
    setRelated(
        results.filter(r => r.note.id !== noteId).slice(0, 3).map(r => r.note)
    );
}, 2000);
```

- Queries top-4 results
- Excludes the current note itself
- Shows up to 3 related notes in the "Related Notes" section
- Links are clickable `<a>` tags opening in the same tab

---

## Limitations

1. **Notes without embeddings are excluded** — Newly created notes may not appear in search results for 1–2 seconds while the background embedding task completes.

2. **No text search** — There is no traditional keyword/full-text search (PostgreSQL `tsvector`). Everything is semantic. Short, specific queries like a note's exact title may score lower than expected.

3. **No search history** — The command palette does not remember previous searches.

4. **Content not shown in results** — Search results show title and tags only (`NoteListItem`), not content snippets. There is no highlight of which part of the note matched.

5. **top_k maximum is 20** — The search endpoint caps results at 20. For very large knowledge bases, increasing this limit requires a backend change.

---

## Related Documents

- [Architecture: AI](../architecture/ai.md)
- [Dataflow: Semantic Search](../dataflow/semantic-search.md)
- [API Reference: Search](../api/search.md)

# Feature: Notes

Notes are the core unit of NeuroNotes. Each note has a title, rich-text content, tags, and a semantic embedding that enables search and graph connections.

## Table of Contents
- [Creating Notes](#creating-notes)
- [The Editor](#the-editor)
- [Autosave](#autosave)
- [Slash Commands](#slash-commands)
- [AI Toolbar](#ai-toolbar)
- [Tags](#tags)
- [Deleting Notes](#deleting-notes)
- [Voice Notes](#voice-notes)
- [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Creating Notes

Notes can be created from three places:

1. **Sidebar**: Click the "New Note" button or press `Ctrl+N`
2. **Dashboard**: Click "New note" button in the Recent Notes card, or the "Create First Note" button in empty state
3. **Command Palette**: Type "create" or select "Create new note" action

All entry points call `notesApi.create("Untitled", "")` which creates a blank note and immediately navigates to `/notes/{id}`.

---

## The Editor

The note editor (`components/Editor.tsx`) uses **TipTap v3** with two extensions:
- `StarterKit` — provides headings, bold, italic, lists, blockquote, code, horizontal rule
- `Placeholder` — shows "Start writing… or type / for AI commands" when empty

Content is stored as **HTML** (TipTap's `getHTML()` output). TipTap's document model handles rich text internally; the HTML is stored in the `notes.content` column.

The editor responds to two key interaction patterns:

### Text selection → AI Toolbar
When the user selects 10+ characters of text, the `AIToolbar` appears above the selection:
```typescript
// frontend/components/Editor.tsx:207-224
onSelectionUpdate: ({ editor }) => {
    const { from, to } = editor.state.selection;
    if (from === to) { setToolbar(null); return; }
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim() || selectedText.length < 10) { setToolbar(null); return; }
    // Calculate position from selection bounding rect
    const rect = range.getBoundingClientRect();
    setToolbar({ text: selectedText, pos: { x: rect.left, y: rect.top - 52 } });
},
```

### "/" keypress → Slash Command Menu
Pressing `/` anywhere in the editor opens the slash command menu:
```typescript
// frontend/components/Editor.tsx:226-235
handleKeyDown: (view, event) => {
    if (event.key === "/") {
        setTimeout(() => {
            const rect = range.getBoundingClientRect();
            setSlashMenu({ pos: { x: rect.left, y: rect.top + 24 } });
        }, 10);
    }
},
```

### AI hint
After 3 seconds of inactivity with >30 characters of content, a subtle hint appears: "Type / for AI commands". It dismisses on the next keypress.

---

## Autosave

Notes save automatically without any user action. The autosave delay is 1500ms (defined as `AUTOSAVE_DELAY = 1500` in `app/notes/[id]/page.tsx`).

```typescript
// frontend/app/notes/[id]/page.tsx:50-56
const scheduleSave = useCallback((newTitle, newContent) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(newTitle, newContent), AUTOSAVE_DELAY);
}, [save]);
```

Every keystroke resets the timer. The save fires 1.5 seconds after the user stops typing.

The save indicator in the top bar shows three states:
- **Saving...** (blue spinner): `PUT /notes/{id}` in flight
- **Saved** (green check): last save succeeded
- **Unsaved** (gray cloud): timer pending, not yet saved

Each save triggers the background embedding task on the backend, keeping semantic search and graph links in sync with the note content.

---

## Slash Commands

Type `/` anywhere in the editor to open the AI command menu. Navigate with arrow keys, select with Enter, dismiss with Escape.

| Command | What it does |
|---------|-------------|
| `/summarize` | Adds a Summary section at the end of the note using `writingAssist("summarize")` |
| `/expand` | Takes the first 300 chars and generates 5-8 expansion ideas, appended as a list |
| `/research` | Takes the first 500 chars, calls `/ai/research`, appends Research summary + insights |
| `/structure` | Rewrites the entire note: new title + structured markdown (Summary, Key Points, Action Items) |
| `/flashcards` | Opens flashcard generation in the ContextPanel |
| `/tags` | Opens tag generation in the ContextPanel |
| `/meeting` | Opens meeting notes extraction in the ContextPanel |

The `/`, `flashcards`, `tags`, and `meeting` commands that delegate to the ContextPanel are listed in the menu but their handling is noted in comments — the ContextPanel handles them via its own AI Actions buttons.

Slash command implementations in `app/notes/[id]/page.tsx`:
```typescript
// frontend/app/notes/[id]/page.tsx:69-119
case "structure": {
    const { title: newTitle, structured_content } = await aiApi.structure(plainText);
    setTitle(newTitle); setContent(structured_content);
    scheduleSave(newTitle, structured_content);
    break;
}
case "summarize": {
    const { result } = await aiApi.writingAssist(plainText, "summarize");
    const newContent = `${content}\n\n<hr/><p><strong>Summary:</strong> ${result}</p>`;
    setContent(newContent); scheduleSave(title, newContent);
    break;
}
```

---

## AI Toolbar

The floating AI toolbar appears when text is selected (minimum 10 characters). It provides five writing actions that apply to the selected text:

| Action | Effect |
|--------|--------|
| **Improve** | Rewrites selected text with better clarity and flow |
| **Summarize** | Condenses selected text to 2-3 sentences |
| **Expand** | Adds more detail and depth to the selected passage |
| **Bullets** | Converts selected text to a bullet list |
| **Explain Simply** | Rewrites for a non-expert audience |

When an action is selected, the toolbar shows a loading spinner. On completion, the selected text is replaced with the AI result:
```typescript
// frontend/components/Editor.tsx:248-255
const applyAIResult = (result: string) => {
    const { from, to } = editor.state.selection;
    editor.chain().focus().deleteRange({ from, to }).insertContent(result).run();
};
```

The toolbar closes automatically when clicking outside it.

---

## Tags

Tags organize notes into topics. They are managed through the ContextPanel (right sidebar on note pages).

### Adding tags manually
Not exposed directly in the current UI — tags are typically added via AI Auto Tags.

### AI Auto Tags
Click "Auto Tags" in the ContextPanel AI Actions section. This calls `POST /ai/tags` with the note content, receives 3-6 lowercase hyphenated tags, and adds each one via `POST /notes/{note_id}/tags/{tag_name}`.

### Removing tags
Each tag in the ContextPanel has an ×button that calls `DELETE /notes/{note_id}/tags/{tag_name}`.

### Tag behavior
- Tags are shared globally — if two notes both have `#machine-learning`, they reference the same `tags` row.
- The `tags` table has a `UNIQUE` constraint on `name`.
- Deleting a note removes its `note_tags` rows (CASCADE) but not the tag itself.

---

## Deleting Notes

The trash icon in the note editor's top bar deletes the current note after confirmation. Deletion calls `notesApi.delete(id)` which sends `DELETE /notes/{id}`. The user is redirected to the dashboard.

The backend delete cascades to `note_tags` and `note_links` via `ON DELETE CASCADE` foreign keys.

---

## Voice Notes

The `VoiceRecorder` component in the note editor top bar provides voice-to-note functionality:

1. Click "Record" → requests browser microphone permission
2. Records `audio/webm` via `MediaRecorder` API
3. Click "Stop" → sends audio to `POST /ai/voice` as multipart form data
4. Backend transcribes with Gemini, then structures as a formatted note
5. Frontend receives `{transcript, title, structured_content}` and updates the current note

The voice recorder shows a red pulsing dot while recording and "AI processing..." during transcription.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | Create new note (from anywhere) |
| `/` | Open AI slash commands in editor |
| `Ctrl+[` | Toggle sidebar collapse |
| Standard TipTap shortcuts | `Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+Z` undo, etc. |

---

## Related Documents

- [Architecture: Frontend](../architecture/frontend.md)
- [Features: AI](ai.md)
- [API Reference: Notes](../api/notes.md)
- [Dataflow: Note Creation](../dataflow/note-creation.md)

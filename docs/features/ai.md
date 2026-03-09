# Feature: AI Features

NeuroNotes integrates Google Gemini AI throughout the workspace. This document covers every AI-powered feature, where it appears in the UI, and what backend endpoint it calls.

## Table of Contents
- [Note Structuring](#note-structuring)
- [Auto-Tagging](#auto-tagging)
- [Flashcard Generation](#flashcard-generation)
- [RAG Chat](#rag-chat)
- [Writing Assist](#writing-assist)
- [Idea Expansion](#idea-expansion)
- [Meeting Notes](#meeting-notes)
- [Voice Notes](#voice-notes)
- [AI Insights](#ai-insights)
- [Knowledge Gap Detection](#knowledge-gap-detection)
- [Link Suggestions](#link-suggestions)
- [Research Assistant](#research-assistant)
- [Daily Insights Banner](#daily-insights-banner)

---

## Note Structuring

**Slash command:** `/structure`
**Endpoint:** `POST /ai/structure`

Takes the raw content of the current note and rewrites it with:
- A generated title
- A structured markdown body with three sections: **Summary**, **Key Points** (bullet list), **Action Items** (bullet list)

The result replaces the entire note content and title. This is useful for voice notes, meeting transcripts, or brain-dump notes that need organizing.

**System prompt used:**
> You are a note-structuring AI. Given raw, unstructured text, output a JSON object with keys: title (string) and structured_content (markdown string). structured_content should have sections: Summary, Key Points (bullet list), Action Items (bullet list).

---

## Auto-Tagging

**UI location:** ContextPanel → AI Actions → "Auto Tags"
**Endpoint:** `POST /ai/tags`

Analyzes the note content and suggests 3-6 lowercase, hyphenated topic tags. After generating, the tags are automatically added to the note by calling `POST /notes/{note_id}/tags/{tag_name}` for each.

Generated tags appear in the ContextPanel where each can be removed by clicking ×.

**System prompt used:**
> You are a tagging AI. Given note content, return a JSON object with a single key "tags" containing a list of 3-6 lowercase hyphenated topic tags (no # prefix). Example: {"tags": ["machine-learning", "deep-learning", "cnn"]}

---

## Flashcard Generation

**UI location:** ContextPanel → AI Actions → "Flashcards"
**Also accessible via:** `/flashcards` slash command (handled by ContextPanel)
**Endpoint:** `POST /ai/flashcards`

Generates 3-8 study flashcards from the note content. Each card has a `question` and an `answer`.

Cards are displayed in the ContextPanel using the `FlashcardViewer` component:
- One card shown at a time with Prev/Next navigation
- Click the card to flip between question (front) and answer (back)
- 3D CSS flip animation

**System prompt used:**
> You are a study AI. Given note content, return a JSON object with key "flashcards", each item having "question" and "answer" keys. Generate 3-8 flashcards.

---

## RAG Chat

**UI location:** `/chat` page (full-page), and the floating AI button (bottom-right corner of every page)
**Endpoint:** `POST /ai/chat`

The central AI interaction feature. Uses Retrieval-Augmented Generation to ground Gemini's responses in the user's actual notes.

### How it works
1. User's question is embedded
2. Top-5 semantically similar notes are retrieved (threshold: 0.4)
3. Relevant notes are injected into the Gemini prompt as context
4. Gemini generates a response grounded in the notes
5. Source notes are shown as clickable links below the response

### Entry points

**Full-page chat** (`/chat` → `AIChat` component):
- Shows the full conversation history
- Source notes displayed as links after each AI response
- Maintains multi-turn conversation

**Floating AI** (`FloatingAI` component, bottom-right):
- Compact slide-in panel
- Shows note context indicator when on a note page
- No source citations (simplified view)
- Same RAG backend as full chat

---

## Writing Assist

**UI location:** Select text in editor → AI toolbar appears → pick action
**Endpoint:** `POST /ai/writing-assist`

Five writing transformations applied to selected text:

| Action | Description |
|--------|-------------|
| **Improve** | Better clarity, flow, and quality |
| **Summarize** | 2-3 sentence condensed version |
| **Expand** | More detail, examples, depth |
| **Bullets** | Convert to bullet point list |
| **Explain Simply** | Rewrite for a beginner audience |

The AI toolbar appears above any selection of 10+ characters. The action replaces the selected text in-place. The toolbar closes after applying a transformation.

---

## Idea Expansion

**UI location:** ContextPanel → AI Actions → "Expand Idea", also `/expand` slash command
**Endpoint:** `POST /ai/expand-idea`

Takes the first 300 characters of the note content and generates 5-8 specific, actionable sub-ideas or expansions.

The `/expand` slash command appends the expansions as a `<ul>` list at the end of the note.

The ContextPanel shows the expansions inline as a bulleted list in the "Expanded Ideas" section.

**System prompt used:**
> You are an idea-expansion AI. Given a short idea, generate 5-8 specific, actionable sub-ideas or expansions. Return JSON: {"expanded": ["idea1", "idea2", ...]}

---

## Meeting Notes

**Slash command:** `/meeting`
**Endpoint:** `POST /ai/meeting-notes`

Takes a meeting transcript (the current note content) and extracts:
- A concise summary paragraph
- Action items (list)
- Key decisions (list)

**System prompt used:**
> You are an expert at processing meeting transcripts. Extract and return JSON with keys: summary (string), action_items (list of strings), key_decisions (list of strings).

Note: The `/meeting` slash command is listed in the editor menu but currently delegates to the ContextPanel. The direct API endpoint exists and is available for programmatic use.

---

## Voice Notes

**UI location:** Note editor top bar → microphone button
**Endpoint:** `POST /ai/voice` (multipart/form-data)

Record a voice note directly in the browser:
1. Click "Record" → browser microphone permission requested
2. Speak → audio captured as `audio/webm` via `MediaRecorder`
3. Click "Stop" → audio sent to backend
4. Backend uses **Gemini 1.5 Flash** (multimodal) to transcribe
5. Transcription is structured into a formatted note with AI-generated title
6. Current note updated with the structured content

Supported audio format: `audio/webm` (Chrome/Firefox default).

---

## AI Insights

**UI location:** `/insights` page, dashboard AI Insights card, ContextPanel AI Insights section
**Endpoint:** `GET /ai/insights`

Aggregates database statistics with AI-generated analysis:

| Field | Source |
|-------|--------|
| `total_notes` | `SELECT COUNT(*) FROM notes` |
| `notes_this_week` | `WHERE created_at >= now() - 7 days` |
| `top_topic` | Tag with highest note count |
| `unfinished_ideas` | Notes with no tags AND content < 150 chars |
| `ai_insight` | Gemini generates one encouraging sentence |
| `suggested_topics` | Gemini suggests 3-4 unexplored topics based on recent note titles |

The `ai_insight` and `suggested_topics` are generated concurrently via `asyncio.gather`.

**Displayed in three places:**
1. **Dashboard card**: Summarized view with total/this-week stats and suggested topics
2. **ContextPanel**: Full insights section with suggested topics to explore next
3. **Insights page**: Full-page breakdown with progress bars, timeline, and all sections

---

## Knowledge Gap Detection

**UI location:** `/insights` page → Knowledge Gaps card, ContextPanel → Knowledge Gaps section
**Endpoint:** `GET /ai/gaps`

Analyzes the user's 30 most recently updated note titles and identifies 4-6 important related concepts that have not been covered. Returns:
- `gaps`: list of topic strings
- `suggestion`: one sentence of encouragement

Gaps are displayed as pill badges. In the Insights page they use amber styling; in the ContextPanel they appear as gray pills.

---

## Link Suggestions

**UI location:** ContextPanel → Connections section
**Endpoint:** `GET /ai/link-suggestions/{note_id}`

For the current note, finds up to 3 semantically similar notes that are not already connected in the knowledge graph (similarity ≥ 0.6, not in `note_links`).

The suggestions are shown as clickable cards in the ContextPanel under "Connections". These are notes the user might want to read or link to manually.

---

## Research Assistant

**Slash command:** `/research`
**Endpoint:** `POST /ai/research`

Analyzes the first 500 characters of the note content as if it were an article or research paper. Returns:
- `summary`: 2-3 sentence overview
- `key_insights`: 4-6 specific findings or insights
- `concepts`: 3-5 important concepts introduced

The `/research` slash command appends the results to the note as a Research section.

**System prompt used:**
> You are an expert research assistant. Given the provided text (article, paper, or notes), return JSON with keys: summary (2-3 sentence summary), key_insights (list of 4-6 specific insights or findings), concepts (list of 3-5 important concepts introduced).

---

## Daily Insights Banner

**UI location:** Note editor (above the TipTap editor, dismissible)
**Component:** `DailyInsights`
**Endpoint:** `GET /ai/insights`

Shows a compact AI insight banner at the top of every note page. Displays:
- AI-generated encouraging message
- Total notes, notes this week, top topic

Can be dismissed (×button) for the current session. Reappears on next page load.

---

## Related Documents

- [Architecture: AI](../architecture/ai.md)
- [Dataflow: RAG Chat](../dataflow/rag-chat.md)
- [API Reference: AI](../api/ai.md)
- [Features: Notes](notes.md)
- [Features: Insights](insights.md)

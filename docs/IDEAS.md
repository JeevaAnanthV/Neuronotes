# NeuroNotes — Top 10 Upgrade Ideas

This document captures the highest-impact feature ideas for the next evolution of NeuroNotes.

---

## 1. Collaborative Notes

Real-time multi-user editing via Supabase Realtime and CRDTs.

**How**: Use Supabase Realtime channels to broadcast document deltas. Each note gets a presence channel; cursors and edits sync via TipTap's collaboration extension (which uses Y.js under the hood). Supabase Realtime handles the broadcast layer.

**Impact**: Transforms NeuroNotes from a personal tool into a team knowledge base — the single biggest unlock for enterprise use.

---

## 2. AI Writing Coach

Inline suggestions as you write, not just on demand.

**How**: Debounce the editor's `onChange` event (1.5s idle). Send the last 3 sentences to Gemini with a ghost-text prompt. Display suggestions in a faded overlay (like GitHub Copilot). Tab to accept.

**Impact**: Reduces friction from "I need to remember to click AI" to "AI is always there." The biggest UX leap possible with existing infrastructure.

---

## 3. Spaced Repetition

Flashcards with SM-2 algorithm scheduling.

**How**: Add a `flashcard_reviews` table in Supabase: `(id, flashcard_id, next_review_at, ease_factor, interval)`. Implement SM-2 in a Python service. A daily digest endpoint returns cards due today. Frontend shows a review queue with pass/fail buttons.

**Impact**: Turns passive note-taking into active learning. Directly addresses the "I took notes but never retained anything" problem.

---

## 4. Knowledge Timeline

Visualize how your understanding of a topic evolved over time.

**How**: Query notes by tag, sort by `created_at`. Use a horizontal timeline component (recharts or d3). Each node shows the note title + a Gemini-generated 1-sentence summary. Hover reveals the full evolution arc.

**Impact**: Makes the invisible visible — users can literally see their thinking evolve. Extremely compelling for researchers and students.

---

## 5. Note Templates

Meeting notes, research notes, daily journal — with AI pre-fill.

**How**: Add a `templates` table with title, structure, and a Gemini system prompt. On new note creation, show a template picker. After selection, call `/ai/structure` with the template prompt to pre-populate sections.

**Impact**: Reduces the blank-page problem. Power users create 10x more notes when they have structure to start from.

---

## 6. Cross-Note Q&A

Ask questions that span multiple notes simultaneously.

**How**: The existing `/ai/chat` RAG endpoint already does this — but the UI only sends the current conversation. Upgrade: add a "Research mode" that retrieves top-20 notes instead of top-5, passes them all as context, and returns a structured answer with citations per section.

**Impact**: Turns the knowledge base into a personal research assistant. This is the "aha moment" feature for power users.

---

## 7. Export to Notion / Obsidian

One-click export with formatting preserved.

**How**: Add a `/export/{format}` endpoint. For Obsidian: convert TipTap HTML to Markdown (using `turndown`), add `[[wikilinks]]` for connected notes, zip into a vault folder. For Notion: use the Notion API to create pages from the note content.

**Impact**: Eliminates the vendor lock-in concern. Users adopt NeuroNotes more readily knowing they can leave.

---

## 8. Smart Reminders

AI detects action items in notes and creates calendar events.

**How**: After each note save, run a background Gemini call with the prompt: "Extract any action items, deadlines, or meetings from this text. Return JSON: {action_items: [{task, due_date}]}." Store in an `action_items` table. Surface in a sidebar widget. Optionally sync to Google Calendar via OAuth.

**Impact**: Bridges the gap between note-taking and task management — the most-requested feature in note apps.

---

## 9. Topic Clustering

Automatic folder/collection creation based on semantic similarity.

**How**: After recomputing the knowledge graph, run k-means clustering on note embeddings (using scikit-learn). Each cluster becomes a "Collection" with an AI-generated name. Store cluster assignments in a `note_clusters` table. Render as folder groups in the sidebar.

**Impact**: Organization emerges automatically. Users with 500+ notes stop feeling lost. Zero manual tagging needed.

---

## 10. Public Knowledge Garden

Selectively publish notes as a public Zettelkasten.

**How**: Add a `is_public` boolean to notes. A separate Next.js `/garden` route renders public notes as a static-like site (ISR). Each public note shows its graph connections to other public notes. A public `/garden/{username}` URL lets users share their knowledge.

**Impact**: Social proof + viral growth. Public knowledge gardens are a trending concept (cf. Andy Matuschak, Maggie Appleton). NeuroNotes becomes a platform, not just a tool.

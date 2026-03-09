# Feature: AI Insights

The AI Insights system analyzes your note-taking patterns and uses Gemini to surface observations about your knowledge journey. Insights appear in multiple places across the application.

## Table of Contents
- [Insights Page](#insights-page)
- [Dashboard Insights Card](#dashboard-insights-card)
- [Context Panel Insights](#context-panel-insights)
- [Daily Insights Banner](#daily-insights-banner)
- [Knowledge Gaps](#knowledge-gaps)
- [Data Sources](#data-sources)

---

## Insights Page

**URL:** `/insights`
**Navigation:** Sidebar → "Insights"

The dedicated insights page provides a comprehensive view of your knowledge activity.

### AI Summary Card
A purple gradient card at the top showing the AI-generated one or two sentence insight about your recent notes.

### Stats Row
Four stat cards:
- **Total Notes**: count of all notes
- **This Week**: notes created in the last 7 days
- **Unfinished Ideas**: notes with no tags AND content < 150 characters
- **Top Topic**: the most-used tag name

### Knowledge Overview
Progress bars showing note count per tag for the top 8 most-used tags. Bars are proportional to the maximum tag count.

### Learning Progress (14 days)
A bar chart showing daily note creation activity for the past 14 days. Today's bar is highlighted in the accent color. Hover a bar to see the date and count in a tooltip.

```
│     │
│  │  │  │
│  │  │  │  │
│  │  │  │  │  │
└────────────────
14d ago        Today
```

### Knowledge Gaps
Amber pill badges showing topics the AI thinks are missing from your knowledge base. Based on the 30 most recently updated note titles.

Below the pills: one sentence of encouragement from Gemini.

### Suggested Exploration
Indigo pill badges for 3-4 related topics you haven't written about yet. These are different from gaps — they're extensions of topics you already cover.

### Recent Activity
Timeline of the 5 most recently modified notes with:
- Blue dot for the most recent, gray dots for others
- Note title (truncated with ellipsis)
- Tags in indigo
- Time ago indicator
- Click to open the note

---

## Dashboard Insights Card

**Location:** Dashboard `/` → middle card of the 3-card grid

Shows a compressed version of insights:
- AI insight text
- 2×2 stat grid: Total Notes and This Week
- Suggested Exploration topics (up to 3 pills)
- "View full insights" link → `/insights`

---

## Context Panel Insights

**Location:** Note editor → right sidebar → "AI Insights" section (collapsed by default as open)

Shows when editing any note:
- AI insight text in an indigo card
- Total Notes and This Week stats
- Top topic
- "Explore next" topics

This section loads automatically when the ContextPanel mounts (on every note page load). It calls `GET /ai/insights` and `GET /ai/gaps` concurrently.

---

## Daily Insights Banner

**Location:** Note editor → above the TipTap editor

A dismissible banner at the top of every note page. Shows:
- Gemini AI icon with gradient background
- "Daily Insight" label
- AI-generated insight sentence
- Total, This Week, Top Topic stats inline

The banner can be dismissed with the × button. It reappears on the next page load (not persisted to localStorage).

---

## Knowledge Gaps

**Endpoint:** `GET /ai/gaps`

Fetches the 30 most recently updated note titles and sends them to Gemini with this prompt:

> Here are the topics a user has written notes about:
> - [title 1]
> - [title 2]
> ...
> Identify 4-6 important related concepts they haven't covered yet.
> Return JSON: {"gaps": ["concept1", "concept2", ...], "suggestion": "one sentence of encouragement"}

The gaps represent blind spots or related areas the user hasn't explored. For example, if notes are about "machine learning" and "neural networks", gaps might include "reinforcement learning", "computer vision", "transfer learning".

**Shown in:**
- Insights page → "Knowledge Gaps" card
- Context panel → "Knowledge Gaps" section (collapsed by default)

---

## Data Sources

All insights come from `GET /ai/insights`. This endpoint:

1. **Database queries** (fast, no AI involved):
   - Total notes count
   - Notes created in last 7 days
   - Top tag by note count
   - Unfinished ideas count (no tags, short content)

2. **Recent note titles** — Fetches 5 most recently updated note titles for AI context

3. **Two concurrent Gemini calls** (`asyncio.gather`):
   - `ai_insight`: one sentence about the user's knowledge journey
   - `suggested_topics`: 3-4 unexplored topics based on recent titles

```python
# backend/routers/ai.py:182-191
ai_insight_task = gemini.generate(
    f"Based on these recent notes, give one concise, encouraging insight about the user's "
    f"knowledge journey (1-2 sentences):\n{note_summaries}"
)
suggested_topics_task = gemini.generate_json(
    f"Based on these note titles, suggest 3-4 related topics the user hasn't covered yet. "
    f"Return JSON: {{\"topics\": [\"topic1\", ...]}}\n{note_summaries}"
)
ai_insight_raw, suggested_data = await asyncio.gather(ai_insight_task, suggested_topics_task)
```

---

## Related Documents

- [Architecture: AI](../architecture/ai.md)
- [Features: AI](ai.md)
- [API Reference: AI](../api/ai.md)

# Dataflow: RAG Chat

This document traces the complete path of data through the Retrieval-Augmented Generation (RAG) chat pipeline when a user asks a question.

## Table of Contents
- [Overview Diagram](#overview-diagram)
- [Step-by-Step Flow](#step-by-step-flow)
- [Prompt Construction](#prompt-construction)
- [Citation Handling](#citation-handling)
- [Conversation History](#conversation-history)
- [Code References](#code-references)

---

## Overview Diagram

```
User types question → clicks Send
        │
        ▼
[Frontend] AIChat or FloatingAI
        │  collect all messages [{role, content}, ...]
        │
        ▼
[Frontend] aiApi.chat(messages)
        │  POST /ai/chat  {"messages": [...]}
        ▼
[Backend] chat_with_notes handler
        │
        ├─ 1. Extract last user message (query)
        │
        ├─ 2. query_embedding = await gemini.embed_text(query)
        │
        ├─ 3. hits = await vs.similarity_search(db, query_embedding, top_k=5)
        │       └─ returns [(note_id, score), ...] ordered by similarity
        │
        ├─ 4. Filter hits: keep only score >= 0.4
        │
        ├─ 5. Bulk-fetch matched notes (single SELECT ... WHERE id IN ...)
        │
        ├─ 6. Build context string:
        │       "=== Note Title ===\n<content>"
        │       for each relevant note
        │
        ├─ 7. Build history string from previous messages
        │
        ├─ 8. Construct full prompt (see below)
        │
        ├─ 9. reply = await gemini.generate(prompt)
        │       └─ asyncio.to_thread(_chat_model.generate_content)
        │
        └─ 10. return ChatResponse(reply=reply, sources=[NoteListItem, ...])
                │
                ▼
[Frontend] renders AI reply + source note links below message
```

---

## Step-by-Step Flow

### Step 1: User sends a message

The user types a question in the `AIChat` component (at `/chat`) or the `FloatingAI` component (available on all pages).

```typescript
// frontend/components/AIChat.tsx:37-39
const allMsgs = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
const { reply, sources } = await aiApi.chat(allMsgs);
setMessages(prev => [...prev, { role: "assistant", content: reply, sources }]);
```

### Step 2: API request

```
POST /ai/chat
Content-Type: application/json

{
  "messages": [
    {"role": "assistant", "content": "Hi! I'm your AI knowledge assistant..."},
    {"role": "user", "content": "What did I write about machine learning?"}
  ]
}
```

### Step 3: Extract the query

```python
# backend/routers/ai.py:63-67
user_messages = [m for m in body.messages if m.role == "user"]
if not user_messages:
    return ChatResponse(reply="Please ask a question.", sources=[])
query = user_messages[-1].content
```

Only the **last user message** is used for the vector search query. This keeps the retrieval focused on the current question rather than all prior context.

### Step 4: Embed the query

```python
query_embedding = await gemini.embed_text(query)
```

The user's question is embedded into the same 768-dim space as all stored note embeddings.

### Step 5: Vector similarity search

```python
hits = await vs.similarity_search(db, query_embedding, top_k=5)
```

Retrieves the top-5 most semantically similar notes. Returns `[(note_id, score), ...]`.

### Step 6: Filter by relevance threshold

```python
# backend/routers/ai.py:72
relevant_hits = [(note_id, score) for note_id, score in hits if score >= 0.4]
```

Notes with similarity < 0.4 are considered too loosely related and excluded from the context. This prevents injecting irrelevant content that could confuse the model.

### Step 7: Fetch matched notes

```python
# backend/routers/ai.py:74-83
if relevant_hits:
    hit_ids = [note_id for note_id, _ in relevant_hits]
    notes_result = await db.execute(select(Note).where(Note.id.in_(hit_ids)))
    notes_by_id = {note.id: note for note in notes_result.scalars().all()}
    for note_id, score in relevant_hits:
        note = notes_by_id.get(note_id)
        if note:
            source_notes.append(NoteListItem.model_validate(note))
            context_parts.append(f"=== {note.title} ===\n{note.content}")
```

### Step 8: Build the prompt

```python
# backend/routers/ai.py:85-95
context = "\n\n".join(context_parts)
history = "\n".join([f"{m.role.upper()}: {m.content}" for m in body.messages[:-1]])

prompt = (
    f"You are a knowledgeable AI assistant with access to the user's personal notes.\n\n"
    f"RELEVANT NOTES:\n{context or 'No relevant notes found.'}\n\n"
    f"CONVERSATION HISTORY:\n{history}\n\n"
    f"USER: {query}\n\n"
    f"Answer the question based on the notes above. If the notes don't contain enough information, "
    f"say so and answer from general knowledge."
)
```

### Step 9: Generate response

```python
reply = await gemini.generate(prompt)
```

`generate` calls `_chat_model.generate_content(full_prompt).text` wrapped in `asyncio.to_thread`. No streaming — the entire response is generated before it is returned.

### Step 10: Return response with sources

```python
return ChatResponse(reply=reply, sources=source_notes)
```

`sources` is a list of `NoteListItem` objects (id, title, tags) for the notes used as context. The frontend renders these as clickable links below the AI reply.

---

## Prompt Construction

The full prompt sent to Gemini looks like:

```
You are a knowledgeable AI assistant with access to the user's personal notes.

RELEVANT NOTES:
=== Machine Learning Fundamentals ===
<full HTML content of the note>

=== Neural Networks Deep Dive ===
<full HTML content of the note>

CONVERSATION HISTORY:
USER: Tell me about neural networks
ASSISTANT: Neural networks are computational models inspired by...

USER: What did I write about backpropagation?

Answer the question based on the notes above. If the notes don't contain enough information,
say so and answer from general knowledge.
```

The note content is sent as raw HTML from TipTap. Gemini handles HTML gracefully but it adds token overhead compared to plain text. Future optimization: strip HTML tags before injection.

---

## Citation Handling

The `sources` field in `ChatResponse` lists the notes used as context. The `AIChat` component renders them below the AI response:

```typescript
// frontend/components/AIChat.tsx:79-99
{m.sources && m.sources.length > 0 && (
    <div style={{ marginTop: "6px" }}>
        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Sources from your notes:
        </div>
        {m.sources.map(s => (
            <a key={s.id} href={`/notes/${s.id}`}>
                📝 {s.title || "Untitled"}
            </a>
        ))}
    </div>
)}
```

The `FloatingAI` component does not show source citations (simplified interface).

When no notes are relevant (all scores < 0.4 or no embeddings exist), the context is `"No relevant notes found."` and `sources` is an empty array.

---

## Conversation History

All previous messages are included in the prompt as `CONVERSATION_HISTORY`. The format is:
```
USER: first question
ASSISTANT: first answer
USER: follow-up question
```

The last user message is excluded from history and instead appears in the `USER:` line at the end of the prompt. This gives the model both the full conversation context and a clear indication of what question to answer.

**Limitation**: There is no token count tracking or history truncation. Very long conversations can exceed Gemini's context window. The frontend does not limit history length.

---

## Code References

| File | Lines | What |
|------|-------|------|
| `frontend/components/AIChat.tsx` | 27–48 | `handleSend` — collects messages, calls API, updates UI |
| `frontend/components/FloatingAI.tsx` | 45–67 | `handleSend` — simplified version without sources |
| `frontend/lib/api.ts` | 115–116 | `aiApi.chat` |
| `backend/routers/ai.py` | 60–97 | `chat_with_notes` endpoint |
| `backend/services/gemini.py` | 31–38 | `generate` |
| `backend/services/vector.py` | 18–35 | `similarity_search` |

---

## Related Documents

- [Architecture: AI](../architecture/ai.md)
- [Dataflow: Semantic Search](semantic-search.md)
- [API Reference: AI](../api/ai.md)
- [Features: AI](../features/ai.md)

# API Reference: AI

All AI-powered endpoints. All generation features use Google Gemini 2.0 Flash unless otherwise noted.

**Base path:** `/ai`

## Table of Contents
- [Structure Note](#structure-note)
- [Generate Tags](#generate-tags)
- [Generate Flashcards](#generate-flashcards)
- [Chat (RAG)](#chat-rag)
- [Writing Assist](#writing-assist)
- [Expand Idea](#expand-idea)
- [Meeting Notes](#meeting-notes)
- [AI Insights](#ai-insights)
- [Voice Note](#voice-note)
- [Knowledge Gaps](#knowledge-gaps)
- [Link Suggestions](#link-suggestions)
- [Research Assistant](#research-assistant)

---

## Structure Note

```
POST /ai/structure
```

Structures raw, unstructured text into a titled note with Summary, Key Points, and Action Items sections.

### Request Body

```json
{
  "text": "had a meeting today discussed the new product roadmap we need to launch by q3 and reduce costs..."
}
```

### Response

```json
{
  "title": "Q3 Product Roadmap Meeting",
  "structured_content": "## Summary\nDiscussed the Q3 product roadmap and cost reduction targets.\n\n## Key Points\n- Launch target: Q3\n- Cost reduction required\n\n## Action Items\n- Finalize roadmap document\n- Schedule cost review"
}
```

### Example

```bash
curl -X POST http://localhost:8000/ai/structure \
  -H "Content-Type: application/json" \
  -d '{"text": "had a meeting today discussed the new product roadmap..."}'
```

---

## Generate Tags

```
POST /ai/tags
```

Generates 3-6 lowercase hyphenated topic tags for the given content.

### Request Body

```json
{
  "content": "Convolutional neural networks use filters to detect features in images..."
}
```

### Response

```json
{
  "tags": ["machine-learning", "deep-learning", "cnn", "computer-vision"]
}
```

### Example

```bash
curl -X POST http://localhost:8000/ai/tags \
  -H "Content-Type: application/json" \
  -d '{"content": "Convolutional neural networks use filters..."}'
```

---

## Generate Flashcards

```
POST /ai/flashcards
```

Generates 3-8 study flashcards from the given content.

### Request Body

```json
{
  "content": "The mitochondria is the powerhouse of the cell. It produces ATP through..."
}
```

### Response

```json
{
  "flashcards": [
    {
      "question": "What is the primary function of mitochondria?",
      "answer": "To produce ATP (energy) for the cell through cellular respiration."
    },
    {
      "question": "What molecule does the mitochondria produce?",
      "answer": "ATP (adenosine triphosphate)"
    }
  ]
}
```

### Example

```bash
curl -X POST http://localhost:8000/ai/flashcards \
  -H "Content-Type: application/json" \
  -d '{"content": "The mitochondria is the powerhouse of the cell..."}'
```

---

## Chat (RAG)

```
POST /ai/chat
```

RAG-powered chat. Retrieves semantically relevant notes (score ≥ 0.4) and includes them as context in the Gemini prompt. Returns the AI reply and the source notes used.

### Request Body

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What did I write about machine learning?"
    }
  ]
}
```

Multi-turn conversation:
```json
{
  "messages": [
    {"role": "user", "content": "Explain neural networks"},
    {"role": "assistant", "content": "Neural networks are..."},
    {"role": "user", "content": "What about backpropagation?"}
  ]
}
```

| Field | Type | Values |
|-------|------|--------|
| `messages` | array | Required |
| `messages[].role` | string | `"user"` or `"assistant"` |
| `messages[].content` | string | Message text |

### Response

```json
{
  "reply": "Based on your notes, machine learning is the practice of training models on data to make predictions...",
  "sources": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Machine Learning Fundamentals",
      "created_at": "2026-03-01T08:00:00Z",
      "updated_at": "2026-03-09T10:00:00Z",
      "tags": [{"id": "...", "name": "ml"}]
    }
  ]
}
```

`sources` is empty when no notes scored ≥ 0.4 or when there are no embeddings.

### Example

```bash
curl -X POST http://localhost:8000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What do I know about Python?"}]}'
```

---

## Writing Assist

```
POST /ai/writing-assist
```

Applies a writing transformation to the given text.

### Request Body

```json
{
  "text": "machine learning is when computers learn from data",
  "action": "improve"
}
```

| Field | Type | Values |
|-------|------|--------|
| `text` | string | Text to transform |
| `action` | string | `improve`, `summarize`, `expand`, `bullet`, `explain` |

| Action | Description |
|--------|-------------|
| `improve` | Better clarity, flow, and quality |
| `summarize` | 2-3 sentence condensation |
| `expand` | More detail, examples, depth |
| `bullet` | Convert to bullet point list |
| `explain` | Rewrite for beginners |

### Response

```json
{
  "result": "Machine learning is a branch of artificial intelligence where algorithms learn patterns from data to make predictions or decisions without being explicitly programmed for each task."
}
```

### Example

```bash
curl -X POST http://localhost:8000/ai/writing-assist \
  -H "Content-Type: application/json" \
  -d '{"text": "ml is when computers learn", "action": "expand"}'
```

---

## Expand Idea

```
POST /ai/expand-idea
```

Generates 5-8 specific, actionable sub-ideas from a short concept.

### Request Body

```json
{
  "idea": "Build a personal knowledge management system"
}
```

### Response

```json
{
  "expanded": [
    "Create a tagging taxonomy with 3-5 main categories and sub-tags",
    "Set up a daily capture habit with a quick-capture inbox",
    "Schedule weekly review sessions to process and link notes",
    "Build an index note that links to all major topic clusters",
    "Use progressive summarization to distill key insights"
  ]
}
```

### Example

```bash
curl -X POST http://localhost:8000/ai/expand-idea \
  -H "Content-Type: application/json" \
  -d '{"idea": "Build a personal knowledge management system"}'
```

---

## Meeting Notes

```
POST /ai/meeting-notes
```

Extracts structured information from a meeting transcript.

### Request Body

```json
{
  "transcript": "John: Let's start with the Q3 roadmap. Sarah: We need to launch feature X by August. John: Agreed, we should assign it to the backend team. Sarah: Also reduce infrastructure costs by 20%..."
}
```

### Response

```json
{
  "summary": "The team discussed the Q3 roadmap, focusing on the launch of feature X and cost reduction goals.",
  "action_items": [
    "Assign feature X development to the backend team",
    "Create a plan to reduce infrastructure costs by 20%",
    "Set an August launch target for feature X"
  ],
  "key_decisions": [
    "Feature X will launch in August",
    "Backend team is responsible for feature X"
  ]
}
```

### Example

```bash
curl -X POST http://localhost:8000/ai/meeting-notes \
  -H "Content-Type: application/json" \
  -d '{"transcript": "discussed Q3 roadmap and feature X launch..."}'
```

---

## AI Insights

```
GET /ai/insights
```

Returns aggregated statistics and AI-generated insights about the user's knowledge base.

### Response

```json
{
  "total_notes": 42,
  "notes_this_week": 7,
  "top_topic": "machine-learning",
  "unfinished_ideas": 3,
  "ai_insight": "You've been deeply exploring machine learning this week — your consistent note-taking shows real momentum in building this knowledge domain.",
  "suggested_topics": ["reinforcement-learning", "nlp", "computer-vision"]
}
```

| Field | Source |
|-------|--------|
| `total_notes` | COUNT(*) from notes table |
| `notes_this_week` | COUNT(*) WHERE created_at >= 7 days ago |
| `top_topic` | Tag with highest note count |
| `unfinished_ideas` | Notes: no tags AND content < 150 chars |
| `ai_insight` | Gemini generated from recent note titles |
| `suggested_topics` | Gemini suggested from recent note titles |

### Example

```bash
curl http://localhost:8000/ai/insights
```

---

## Voice Note

```
POST /ai/voice
Content-Type: multipart/form-data
```

Transcribes an audio file and structures it as a formatted note. Uses Gemini 1.5 Flash (multimodal).

### Request Body (form data)

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | Audio file (audio/webm, audio/mp4, etc.) |

### Response

```json
{
  "transcript": "So today I was thinking about the knowledge graph feature and how we could improve the visualization...",
  "title": "Knowledge Graph Visualization Ideas",
  "structured_content": "## Summary\nIdeas for improving the knowledge graph visualization feature.\n\n## Key Points\n- Consider adding node clustering\n- Improve edge visual encoding\n\n## Action Items\n- Prototype clustering algorithm\n- Get user feedback on current graph"
}
```

### Example

```bash
curl -X POST http://localhost:8000/ai/voice \
  -F "file=@recording.webm;type=audio/webm"
```

---

## Knowledge Gaps

```
GET /ai/gaps
```

Analyzes the user's 30 most recently updated note titles and identifies important concepts that are missing.

### Response

```json
{
  "gaps": [
    "Reinforcement Learning",
    "Transformer Architecture",
    "Model Deployment",
    "Ethical AI"
  ],
  "suggestion": "Your notes show strong fundamentals in ML — exploring transformer architectures next would connect beautifully with your existing deep learning knowledge."
}
```

Returns `{"gaps": [], "suggestion": "Create some notes first..."}` if there are no notes.

### Example

```bash
curl http://localhost:8000/ai/gaps
```

---

## Link Suggestions

```
GET /ai/link-suggestions/{note_id}
```

Returns up to 3 notes that are semantically similar to the given note (similarity ≥ 0.6) but not yet connected in the knowledge graph.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `note_id` | UUID | Note to find connections for |

### Response

```json
{
  "suggestions": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Neural Networks Overview",
      "created_at": "2026-03-02T09:00:00Z",
      "updated_at": "2026-03-08T14:00:00Z",
      "tags": [{"id": "...", "name": "deep-learning"}]
    }
  ]
}
```

Returns `{"suggestions": []}` if the note has no embedding or no unlinked similar notes found.

### Example

```bash
curl http://localhost:8000/ai/link-suggestions/550e8400-e29b-41d4-a716-446655440000
```

---

## Research Assistant

```
POST /ai/research
```

Analyzes text as if it were an article or research paper and extracts structured information.

### Request Body

```json
{
  "text": "Attention Is All You Need (Vaswani et al., 2017) introduces the Transformer architecture..."
}
```

### Response

```json
{
  "summary": "The Transformer architecture introduced self-attention mechanisms that replaced recurrence in sequence modeling tasks, achieving state-of-the-art results in machine translation.",
  "key_insights": [
    "Self-attention allows the model to relate positions across the sequence in O(1) operations",
    "Multi-head attention enables attending to different representation subspaces",
    "Positional encoding adds sequence order information without recurrence",
    "The architecture achieves better parallelization than RNNs"
  ],
  "concepts": [
    "Self-attention",
    "Multi-head attention",
    "Positional encoding",
    "Encoder-decoder architecture"
  ]
}
```

### Example

```bash
curl -X POST http://localhost:8000/ai/research \
  -H "Content-Type: application/json" \
  -d '{"text": "Attention Is All You Need introduces the Transformer architecture..."}'
```

---

## Related Documents

- [API Overview](overview.md)
- [Architecture: AI](../architecture/ai.md)
- [Features: AI](../features/ai.md)
- [Dataflow: RAG Chat](../dataflow/rag-chat.md)

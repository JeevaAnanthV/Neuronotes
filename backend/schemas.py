import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


# ── Tag ────────────────────────────────────────────────────────────────────────

class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class TagRead(TagBase):
    id: uuid.UUID
    model_config = {"from_attributes": True}

class TagWithCount(BaseModel):
    id: uuid.UUID
    name: str
    note_count: int
    model_config = {"from_attributes": True}


# ── Note ───────────────────────────────────────────────────────────────────────

class NoteBase(BaseModel):
    title: str = "Untitled"
    content: str = ""

class NoteCreate(NoteBase):
    pass

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class NoteRead(NoteBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    tags: list[TagRead] = []
    model_config = {"from_attributes": True}

class NoteListItem(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    tags: list[TagRead] = []
    model_config = {"from_attributes": True}


# ── Search ─────────────────────────────────────────────────────────────────────

class SearchResult(BaseModel):
    note: NoteListItem
    score: float


# ── Graph ──────────────────────────────────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    title: str
    tags: list[str] = []

class GraphEdge(BaseModel):
    source: str
    target: str
    similarity: float

class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# ── AI Requests / Responses ────────────────────────────────────────────────────

class StructureRequest(BaseModel):
    text: str

class StructureResponse(BaseModel):
    title: str
    structured_content: str

class TagsRequest(BaseModel):
    content: str

class TagsResponse(BaseModel):
    tags: list[str]

class FlashcardsRequest(BaseModel):
    content: str

class Flashcard(BaseModel):
    question: str
    answer: str

class FlashcardsResponse(BaseModel):
    flashcards: list[Flashcard]

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    note_ids: Optional[list[str]] = None

class ChatResponse(BaseModel):
    reply: str
    sources: list[NoteListItem] = []

class WritingAssistRequest(BaseModel):
    text: str
    action: str  # "improve" | "summarize" | "expand" | "bullet" | "explain"

class WritingCoachRequest(BaseModel):
    text: str

class WritingAssistResponse(BaseModel):
    result: str

class ExpandIdeaRequest(BaseModel):
    idea: str

class ExpandIdeaResponse(BaseModel):
    expanded: list[str]

class MeetingNotesRequest(BaseModel):
    transcript: str

class MeetingNotesResponse(BaseModel):
    summary: str
    action_items: list[str]
    key_decisions: list[str]

class InsightsResponse(BaseModel):
    total_notes: int
    notes_this_week: int
    top_topic: str
    unfinished_ideas: int
    ai_insight: str
    suggested_topics: list[str] = []

class VoiceNoteResponse(BaseModel):
    transcript: str
    structured_content: str
    title: str


# ── Phase 3 — Advanced AI ──────────────────────────────────────────────────────

class GapsResponse(BaseModel):
    gaps: list[str]
    suggestion: str

class LinkSuggestionsResponse(BaseModel):
    suggestions: list[NoteListItem]

class ResearchRequest(BaseModel):
    text: str

class ResearchResponse(BaseModel):
    summary: str
    key_insights: list[str]
    concepts: list[str]


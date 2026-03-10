/**
 * NeuroNotes FastAPI client for React Native.
 * Ported from frontend/lib/api.ts — same endpoints, axios transport.
 */
import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8001';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Tag {
  id: string;
  name: string;
}

export interface TagWithCount {
  id: string;
  name: string;
  note_count: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface NoteListItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface SearchResult {
  note: NoteListItem;
  score: number;
}

export interface GraphNode {
  id: string;
  title: string;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  similarity: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface InsightsData {
  total_notes: number;
  notes_this_week: number;
  top_topic: string;
  unfinished_ideas: number;
  ai_insight: string;
  suggested_topics: string[];
}

// ── Notes API ─────────────────────────────────────────────────────────────────

export const notesApi = {
  list: (): Promise<NoteListItem[]> =>
    api.get<NoteListItem[]>('/notes/').then((r) => r.data),

  get: (id: string): Promise<Note> =>
    api.get<Note>(`/notes/${id}`).then((r) => r.data),

  create: (title: string, content: string): Promise<Note> =>
    api.post<Note>('/notes/', { title, content }).then((r) => r.data),

  update: (id: string, data: { title?: string; content?: string }): Promise<Note> =>
    api.put<Note>(`/notes/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/notes/${id}`).then(() => undefined),

  addTag: (noteId: string, tagName: string): Promise<Note> =>
    api.post<Note>(`/notes/${noteId}/tags/${tagName}`).then((r) => r.data),

  removeTag: (noteId: string, tagName: string): Promise<Note> =>
    api.delete<Note>(`/notes/${noteId}/tags/${tagName}`).then((r) => r.data),
};

// ── Tags API ──────────────────────────────────────────────────────────────────

export const tagsApi = {
  list: (): Promise<TagWithCount[]> =>
    api.get<TagWithCount[]>('/tags/').then((r) => r.data),
};

// ── Search API ────────────────────────────────────────────────────────────────

export const searchApi = {
  semantic: (q: string, topK = 8): Promise<SearchResult[]> =>
    api.get<SearchResult[]>('/search/', { params: { q, top_k: topK } }).then((r) => r.data),
};

// ── AI API ────────────────────────────────────────────────────────────────────

export const aiApi = {
  structure: (text: string) =>
    api
      .post<{ title: string; structured_content: string }>('/ai/structure', { text })
      .then((r) => r.data),

  generateTags: (content: string) =>
    api.post<{ tags: string[] }>('/ai/tags', { content }).then((r) => r.data),

  flashcards: (content: string) =>
    api.post<{ flashcards: Flashcard[] }>('/ai/flashcards', { content }).then((r) => r.data),

  chat: (
    messages: { role: string; content: string }[],
    note_ids?: string[],
  ) =>
    api
      .post<{ reply: string; sources: NoteListItem[] }>('/ai/chat', { messages, note_ids })
      .then((r) => r.data),

  writingCoach: (text: string) =>
    api.post<{ suggestion: string }>('/ai/writing-coach', { text }).then((r) => r.data),

  writingAssist: (text: string, action: string) =>
    api.post<{ result: string }>('/ai/writing-assist', { text, action }).then((r) => r.data),

  expandIdea: (idea: string) =>
    api.post<{ expanded: string[] }>('/ai/expand-idea', { idea }).then((r) => r.data),

  insights: () =>
    api.get<InsightsData>('/ai/insights').then((r) => r.data),

  voice: (formData: FormData) =>
    api
      .post<{ transcript: string; structured_content: string; title: string }>(
        '/ai/voice',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      .then((r) => r.data),

  research: (text: string) =>
    api
      .post<{ summary: string; key_insights: string[]; concepts: string[] }>('/ai/research', { text })
      .then((r) => r.data),

  linkSuggestions: (noteId: string) =>
    api
      .get<{ suggestions: NoteListItem[] }>(`/ai/link-suggestions/${noteId}`)
      .then((r) => r.data),
};

// ── Graph API ─────────────────────────────────────────────────────────────────

export const graphApi = {
  get: (): Promise<GraphData> =>
    api.get<GraphData>('/graph/').then((r) => r.data),

  recompute: (threshold = 0.72) =>
    api
      .post<{ links_created: number }>('/graph/recompute', null, { params: { threshold } })
      .then((r) => r.data),
};

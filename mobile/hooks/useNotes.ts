import { useState, useCallback } from 'react';
import { notesApi, type Note, type NoteListItem } from '@/lib/api';

interface UseNotesReturn {
  notes: NoteListItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createNote: (title: string, content?: string) => Promise<Note>;
  updateNote: (id: string, data: { title?: string; content?: string }) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
}

export function useNotes(): UseNotesReturn {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notesApi.list();
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  const createNote = useCallback(async (title: string, content = ''): Promise<Note> => {
    const note = await notesApi.create(title, content);
    // Optimistic: prepend to list
    setNotes((prev) => [
      { id: note.id, title: note.title, created_at: note.created_at, updated_at: note.updated_at, tags: note.tags },
      ...prev,
    ]);
    return note;
  }, []);

  const updateNote = useCallback(
    async (id: string, data: { title?: string; content?: string }): Promise<Note> => {
      const note = await notesApi.update(id, data);
      // Optimistic: update in list
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, title: note.title, updated_at: note.updated_at, tags: note.tags }
            : n,
        ),
      );
      return note;
    },
    [],
  );

  const deleteNote = useCallback(async (id: string): Promise<void> => {
    await notesApi.delete(id);
    // Optimistic: remove from list
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notes, loading, error, refresh, createNote, updateNote, deleteNote };
}

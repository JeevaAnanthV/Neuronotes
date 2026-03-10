import { useState, useCallback } from 'react';
import { aiApi, type Flashcard } from '@/lib/api';

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        return await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI service error. Check backend connection.');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const generateTags = useCallback(
    (content: string): Promise<string[] | null> =>
      withLoading(async () => {
        const { tags } = await aiApi.generateTags(content);
        return tags;
      }),
    [withLoading],
  );

  const generateFlashcards = useCallback(
    (content: string): Promise<Flashcard[] | null> =>
      withLoading(async () => {
        const { flashcards } = await aiApi.flashcards(content);
        return flashcards;
      }),
    [withLoading],
  );

  const summarize = useCallback(
    (text: string): Promise<string | null> =>
      withLoading(async () => {
        const { result } = await aiApi.writingAssist(text, 'summarize');
        return result;
      }),
    [withLoading],
  );

  const expand = useCallback(
    (text: string): Promise<string[] | null> =>
      withLoading(async () => {
        const { expanded } = await aiApi.expandIdea(text);
        return expanded;
      }),
    [withLoading],
  );

  const writingCoach = useCallback(
    (text: string): Promise<string | null> =>
      withLoading(async () => {
        const { suggestion } = await aiApi.writingCoach(text);
        return suggestion;
      }),
    [withLoading],
  );

  const chat = useCallback(
    (
      messages: { role: string; content: string }[],
      noteIds?: string[],
    ) =>
      withLoading(async () => {
        return await aiApi.chat(messages, noteIds);
      }),
    [withLoading],
  );

  return {
    loading,
    error,
    generateTags,
    generateFlashcards,
    summarize,
    expand,
    writingCoach,
    chat,
  };
}

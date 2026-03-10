/**
 * SM-2 Spaced Repetition Algorithm
 * Direct port from frontend/app/flashcards/page.tsx
 *
 * quality: 0 = Again, 2 = Hard, 4 = Good, 5 = Easy
 */

export interface CardState {
  repetitions: number;
  easiness: number;
  interval: number;
  nextReview: number;
}

export const DEFAULT_CARD_STATE: CardState = {
  repetitions: 0,
  easiness: 2.5,
  interval: 1,
  nextReview: Date.now(),
};

/**
 * Apply one SM-2 rating cycle.
 * Returns the updated state (nextReview not set — caller adds ms offset).
 */
export function sm2(
  quality: number,
  repetitions: number,
  easiness: number,
  interval: number,
): { easiness: number; repetitions: number; interval: number } {
  const newEasiness = Math.max(
    1.3,
    easiness + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
  );
  const newRepetitions = quality >= 3 ? repetitions + 1 : 0;
  const newInterval =
    newRepetitions <= 1
      ? 1
      : newRepetitions === 2
      ? 6
      : Math.round(interval * newEasiness);

  return { easiness: newEasiness, repetitions: newRepetitions, interval: newInterval };
}

/**
 * Rate a card and compute the full new CardState including nextReview timestamp.
 */
export function rateCard(card: CardState, quality: number): CardState {
  const result = sm2(quality, card.repetitions, card.easiness, card.interval);
  const nextReview = Date.now() + result.interval * 86_400_000;
  return { ...result, nextReview };
}

/**
 * Hash a string to a stable short identifier.
 */
export function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * Storage key for a card state.
 */
export function cardStorageKey(noteId: string, hash: string): string {
  return `fc:${noteId}:${hash}`;
}

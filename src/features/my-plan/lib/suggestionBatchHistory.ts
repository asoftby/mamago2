/**
 * Client-only stack of already-fetched suggestion batches.
 * "More" appends a new server batch; "Previous" only moves the index — no API.
 */

export type SuggestionBatchHistory<T> = {
  batches: T[][];
  index: number;
};

export function emptySuggestionBatchHistory<T>(): SuggestionBatchHistory<T> {
  return { batches: [], index: -1 };
}

export function canGoBackSuggestionBatch<T>(history: SuggestionBatchHistory<T>): boolean {
  return history.index > 0;
}

export function currentSuggestionBatch<T>(history: SuggestionBatchHistory<T>): T[] | null {
  if (history.index < 0 || history.index >= history.batches.length) return null;
  return history.batches[history.index] ?? null;
}

/**
 * Append a freshly fetched batch and point the cursor at it.
 * When already looking at an older batch, truncate the forward tail first
 * (browser-history semantics) so "more" never forks silently.
 * Caps the stack at `maxBatches` (oldest dropped).
 */
export function appendSuggestionBatch<T>(
  history: SuggestionBatchHistory<T>,
  batch: readonly T[],
  maxBatches: number,
): SuggestionBatchHistory<T> {
  const cap = Math.max(1, Math.floor(maxBatches));
  const kept =
    history.index >= 0 && history.index < history.batches.length
      ? history.batches.slice(0, history.index + 1)
      : [...history.batches];
  kept.push([...batch]);
  const overflow = Math.max(0, kept.length - cap);
  const batches = overflow > 0 ? kept.slice(overflow) : kept;
  return { batches, index: batches.length - 1 };
}

/** Move one step back in the stack. No-op when already at the first batch. */
export function goBackSuggestionBatch<T>(
  history: SuggestionBatchHistory<T>,
): SuggestionBatchHistory<T> {
  if (!canGoBackSuggestionBatch(history)) return history;
  return { batches: history.batches, index: history.index - 1 };
}

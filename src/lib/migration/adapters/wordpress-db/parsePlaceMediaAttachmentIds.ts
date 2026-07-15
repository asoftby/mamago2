/**
 * Parses WordPress attachment-id postmeta values into a deduplicated,
 * order-preserving list of positive integer ids.
 *
 * Handles every real shape confirmed against live Place data (2026-07-15
 * read-only audit, all 82 published Places):
 * - a comma-separated scalar in one postmeta row (`gallery`'s real shape —
 *   e.g. `"5391,5392,5393"`, not one row per id as earlier code assumed);
 * - a single id in one row (`cover`'s shape);
 * - multiple separate rows, each one id (the shape other entities —
 *   Route/Event/Offer — actually use), each split by comma too so a
 *   caller never needs to know in advance which shape a given source uses.
 *
 * Pure — no DB reads, no I/O. Never throws on malformed input: invalid
 * tokens (non-numeric, negative, zero, empty) are collected and returned
 * separately rather than silently dropped or allowed to crash the whole
 * parse — the caller decides whether/how to warn.
 */
export interface ParsedAttachmentIdsResult {
  /** Positive integers only, in first-seen order, deduplicated. */
  ids: readonly number[];
  /** Exactly the raw tokens that failed validation, in encounter order — never deduplicated, so a caller can report every occurrence. */
  invalidTokens: readonly string[];
}

const POSITIVE_INTEGER_RE = /^\d+$/;

export function parsePlaceMediaAttachmentIds(
  rawValues: readonly string[] | undefined,
): ParsedAttachmentIdsResult {
  if (!rawValues || rawValues.length === 0) {
    return { ids: [], invalidTokens: [] };
  }

  const seen = new Set<number>();
  const ids: number[] = [];
  const invalidTokens: string[] = [];

  for (const rawValue of rawValues) {
    const tokens = rawValue
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    for (const token of tokens) {
      if (!POSITIVE_INTEGER_RE.test(token)) {
        invalidTokens.push(token);
        continue;
      }
      const id = Number(token);
      if (!Number.isSafeInteger(id) || id <= 0) {
        invalidTokens.push(token);
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  return { ids, invalidTokens };
}

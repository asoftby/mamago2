/**
 * DirectThread.threadNumber is stored as a plain Int (e.g. 10253) — never as
 * a prefixed string — so it stays trivial to search/sort/index. The "D-"
 * prefix is purely presentational and goes through this single helper, so
 * a future Direct variant (e.g. "P-" for a different flow) only needs a new
 * prefix argument, not a storage change.
 */
export function formatDirectThreadNumber(threadNumber: number, prefix = "D"): string {
  return `${prefix}-${threadNumber}`;
}

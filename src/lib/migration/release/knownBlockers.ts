/**
 * Single source of truth for the 5 Users sourceRecordKeys whose historical
 * `first_name`/`last_name` input is unrecoverable (2026-07-30 bounded
 * read-only WP capture + semantic reconciliation against approved LOCAL
 * `MigrationRecord.normalizedPayload` ground truth reproduced 559/564
 * canonicalCandidateHash entries via one uniform rule; these 5 did not
 * reproduce, and per explicit product decision no per-user override is
 * permitted).
 *
 * Both `generate-phoenix-release-manifest.ts` (the users phase blocker)
 * and `generate-phoenix-business-ownership-artifacts.ts` (excluding
 * `wordpress-db:user:43` — one of the 36 EXACT_LINK_CANDIDATE users —
 * from the businesses phase's executable records) must read this same
 * list. Two independent hardcoded copies previously let `user:43` sit
 * unexcluded in the businesses phase's records, which would have halted
 * a sequential apply on it forever (its User can never exist) instead of
 * processing the ~25 valid candidates after it.
 */
export const USERS_UNRESOLVED_SOURCE_RECORD_KEYS = [
  "wordpress-db:user:7",
  "wordpress-db:user:17",
  "wordpress-db:user:22",
  "wordpress-db:user:42",
  "wordpress-db:user:43",
] as const;

/**
 * Fail-closed check for the founder-approved exclusion set: it must
 * contain no duplicates, and must match `expected` exactly — not a
 * superset, not a subset, not a substitution. Used both by the release
 * manifest generator (before it will mark the users phase READY) and by
 * tests, so the guarantee is exercised the same way in both places.
 */
export function assertExactExclusionSet(actual: readonly string[], expected: readonly string[]): void {
  if (new Set(actual).size !== actual.length) {
    throw new Error(`DUPLICATE_EXCLUSION: ${actual.join(", ")}`);
  }
  if (actual.length !== expected.length) {
    throw new Error(`EXCLUSION_COUNT_MISMATCH: expected ${expected.length}, got ${actual.length}.`);
  }
  const expectedSet = new Set(expected);
  const unknown = actual.find((key) => !expectedSet.has(key));
  if (unknown) {
    throw new Error(`UNKNOWN_EXCLUSION_KEY: ${unknown}`);
  }
  const actualSet = new Set(actual);
  const missing = expected.find((key) => !actualSet.has(key));
  if (missing) {
    throw new Error(`MISSING_EXCLUSION_KEY: ${missing}`);
  }
}

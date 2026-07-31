/**
 * Single source of truth for the Users sourceRecordKeys whose historical
 * `first_name`/`last_name` input is unrecoverable (2026-07-30 bounded
 * read-only WP capture + semantic reconciliation against approved LOCAL
 * `MigrationRecord.normalizedPayload` ground truth reproduced canonical-
 * CandidateHash entries via one uniform rule; these did not reproduce,
 * and per explicit product decision no per-user override is permitted).
 *
 * `wordpress-db:user:43` was originally in this list (2026-07-31) but was
 * reincluded by explicit founder decision the same day
 * (`WP_USER_43_REINCLUDED_FOR_CONTENT_OWNERSHIP` — see
 * `docs/migration/phoenix-places-owner-scope-gap-2026-07-31.md`): excluding
 * it silently orphaned real dependent content (1 Place, 4 Offers) it is
 * the legacy WordPress author of, and its missing surname has no schema
 * dependency (`User` has no `lastName` column — only `displayName`, which
 * WordPress's own `display_name` field already supplies). It now migrates
 * as a normal USER via the standard capture/plan/write path, with its
 * `display_name` as the sole name source — no fabricated surname.
 *
 * Both `generate-phoenix-release-manifest.ts` (the users phase blocker)
 * and `generate-phoenix-business-ownership-artifacts.ts` (excluding these
 * keys from the businesses phase's executable records where they overlap
 * an EXACT_LINK_CANDIDATE) must read this same list. Two independent
 * hardcoded copies previously let `user:43` sit unexcluded in the
 * businesses phase's records, which would have halted a sequential apply
 * on it forever (its User could never exist) instead of processing the
 * valid candidates after it — that risk no longer applies to `user:43`
 * specifically now that it is a real, resolvable User.
 */
export const USERS_UNRESOLVED_SOURCE_RECORD_KEYS = [
  "wordpress-db:user:7",
  "wordpress-db:user:17",
  "wordpress-db:user:22",
  "wordpress-db:user:42",
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

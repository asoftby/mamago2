import type { MediaPolicy, MigrationEnvironment } from "./MigrationProfile";
import { MEDIA_POLICIES } from "./MigrationProfile";

/**
 * Read-only selected 2026-07-15 against the live WordPress DB
 * (`--allow-remote-readonly`) — 3 Event + 3 Place + 3 Offer, each with
 * confirmed real attachment evidence (cover/gallery ids that actually
 * exist in `wp_postmeta`), covering "regular cover", "cover + gallery",
 * and "most complex shape" per entity. Full rationale in
 * `docs/migration/prelaunch-checklist.md` §1 "Sampled media policy".
 *
 * Offers: all 91 published `hb-programs`/`services` were checked — only
 * 3 have both real media evidence AND an unambiguous single Place
 * relation, and all 3 happen to relate to the same Place (8901,
 * "«Penguin»"). That is the genuine shape of the source data, not a
 * selection artifact — documented here rather than papered over.
 */
export const DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS: readonly string[] = [
  // Events — cover only; cover + gallery (the only event with >1 asset); cover-only but a multi-week camp-program format (structural outlier, not a media-count one — no event in the source has more than one gallery image).
  "wordpress-db:events:42041",
  "wordpress-db:events:62097",
  "wordpress-db:events:60404",
  // Places — cover + gallery(14) + logo; gallery(10) with no cover at all (edge case); cover + logo + gallery(11, with one id shared between cover and gallery) — the most complex real shape found.
  "wordpress-db:places:5389",
  "wordpress-db:places:895",
  "wordpress-db:places:43023",
  // Offers — cover + gallery; gallery only; gallery only. All 3 relate to Place 8901.
  "wordpress-db:hb-programs:15941",
  "wordpress-db:hb-programs:16403",
  "wordpress-db:hb-programs:16458",
];

export const SKIPPED_BY_MEDIA_SAMPLE_POLICY_REASON = "SKIPPED_BY_MEDIA_SAMPLE_POLICY";

export interface ResolveSampledMediaPolicyInput {
  environment: MigrationEnvironment;
  sourceRecordKey: string;
  /**
   * Defaults to `DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS`. An explicit empty
   * array or a malformed value (not an array of non-empty strings) both
   * fail closed to METADATA in LOCAL/DEV — never silently falls back to
   * FULL for everyone.
   */
  fullMediaSourceRecordKeys?: readonly string[];
}

export interface SampledMediaPolicyResult {
  policy: MediaPolicy;
  /**
   * Present only when this specific record was downgraded from what would
   * otherwise be FULL, purely because it's outside the LOCAL/DEV sample
   * allowlist — never set for PRODUCTION (unconditional FULL) and never
   * an error/warning severity on its own; callers surface it as an INFO
   * note, not a problem.
   */
  reason?: typeof SKIPPED_BY_MEDIA_SAMPLE_POLICY_REASON;
}

function isValidAllowlist(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

/**
 * Per-record media policy for LOCAL/DEV/PROD, keyed by the migration
 * engine's own `sourceRecordKey` — never a target id, never a random/
 * positional sample, never `NODE_ENV`. Entity type is implicit in the
 * key's own prefix (`wordpress-db:events:…`/`wordpress-db:places:…`/
 * `wordpress-db:hb-programs:…`|`wordpress-db:services:…`), so this
 * function needs no separate entity-type parameter — an exact key match
 * is both simpler and stricter than a scope-based check.
 *
 * - PRODUCTION: always FULL, unconditionally — the sample allowlist has
 *   no effect on production, by design (the whole point of a "local/dev
 *   sample" is that production is not sampled).
 * - LOCAL/DEV: FULL only for an allowlisted `sourceRecordKey`, METADATA
 *   for everything else. An empty or malformed allowlist fails closed to
 *   METADATA for every record, including allowlisted ones that would
 *   otherwise match — sampling can only ever narrow access to FULL, never
 *   silently widen it.
 * - Any other/unknown `environment` value: fails closed to METADATA, the
 *   same as an invalid allowlist. This function never returns FULL for
 *   anything it doesn't positively recognize as PRODUCTION.
 *
 * Pure and deterministic — same input always produces the same output,
 * no clock, no randomness, no I/O.
 */
export function resolveSampledMediaPolicy(input: ResolveSampledMediaPolicyInput): SampledMediaPolicyResult {
  if (input.environment === "PROD") {
    return { policy: MEDIA_POLICIES.FULL };
  }

  if (input.environment !== "LOCAL" && input.environment !== "DEV") {
    return { policy: MEDIA_POLICIES.METADATA, reason: SKIPPED_BY_MEDIA_SAMPLE_POLICY_REASON };
  }

  const requestedAllowlist = input.fullMediaSourceRecordKeys ?? DEFAULT_FULL_MEDIA_SOURCE_RECORD_KEYS;
  const allowlist = isValidAllowlist(requestedAllowlist) ? requestedAllowlist : [];

  if (allowlist.includes(input.sourceRecordKey)) {
    return { policy: MEDIA_POLICIES.FULL };
  }

  return { policy: MEDIA_POLICIES.METADATA, reason: SKIPPED_BY_MEDIA_SAMPLE_POLICY_REASON };
}

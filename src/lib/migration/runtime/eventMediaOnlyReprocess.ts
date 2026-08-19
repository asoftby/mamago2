/**
 * A narrow, deliberately separate replay path for a single Event's media
 * only — added because the generic `--force-reprocess` flag is unsafe here:
 * it flips a plan item to `UPDATE`, which sends the record through
 * `EventCommitRunner`'s real UPDATE path, and that path deletes/recreates
 * `ActivitySession` rows and re-upserts `EventVenue` (see
 * `docs/migration/prelaunch-checklist.md`, Event UPDATE-safety finding,
 * 2026-07-20). Recovering one skipped cover image is not worth that blast
 * radius. This module never touches `EventCommitRunner`, `Activity` domain
 * fields, `ActivitySession`, `EventVenue`, or `MigrationLineage(ACTIVITY)`.
 *
 * The actual write is delegated to `runStrictEventMediaReplay()`
 * (`strictEventMediaReplay.ts`) — plain `EventMediaSyncerLike.sync()` has
 * destructive-replacement semantics (a failed/partial import can wipe an
 * existing cover or gallery item) that are correct for a real commit but
 * unsafe for a standalone recovery tool; the strict replay is fail-closed
 * instead: any missing attachment, invalid URL, download failure, or
 * unproven existing target media refuses the whole operation before
 * touching `Activity`/`ActivityImage` at all.
 *
 * Three guard layers:
 * - `validateEventMediaOnlyReprocessArgs()` — pure, synchronous, CLI-flag-only
 *   checks (entity/source-record-key count/media-policy/conflicting flags).
 * - `validateEventMediaOnlyReprocessRuntime()` — needs a live source fetch +
 *   lineage/target lookup; the hash-equality check is the one that matters
 *   most: this replay is only ever allowed when the freshly computed
 *   canonical hash is byte-identical to the stored lineage hash, i.e. there
 *   is zero possibility of a domain-content change riding along with the
 *   media fix. Also applies the same past-only-Event eligibility policy the
 *   real migration planner uses (`EVENT_PAST_ONLY_EXCLUDED`, see
 *   `core/orchestrator.ts`'s `isPastOnlyExcludedEvent()`) — a past-only
 *   Event is refused here too, before any media preflight/import/write.
 * - `runStrictEventMediaReplay()`'s own preflight/divergence checks (see
 *   that module) — the actual media-level safety gate.
 */
import { CANONICAL_SOURCE_HASH_VERSION, hashEventBundle } from "../adapters/wordpress-db/canonicalSourceHash";
import { normalizeEvent } from "../adapters/wordpress-db/normalizeEvent";
import type { WordPressEventBundle } from "../adapters/wordpress-db/types";
import type { MigrationWarning } from "../types";
import type { NormalizedEventCandidate } from "../commit/event/types";
import type { MediaPolicyName } from "./MigrationProfile";
import {
  runStrictEventMediaReplay,
  type StrictEventMediaImporter,
  type StrictEventMediaReplayCurrentState,
  type StrictEventMediaReplayPrismaClient,
  type StrictEventMediaReplayResult,
} from "./strictEventMediaReplay";

const EVENT_SOURCE_RECORD_KEY_PATTERN = /^wordpress-db:events:(\d+)$/;

/**
 * Same exact warning code `core/orchestrator.ts`'s own
 * `isPastOnlyExcludedEvent()` checks to plan a past-only Event as
 * `SKIP_POLICY` (Phoenix v1 never migrates past-only Events — see
 * `docs/migration/prelaunch-checklist.md` §0.6). Media-only replay must
 * apply the identical eligibility policy: never checked via
 * `scheduleDraft === null` alone, since that's also produced by a missing
 * or unparseable schedule — an entirely different, unrelated case this
 * exact warning code disambiguates from "every session was in the past".
 */
const EVENT_PAST_ONLY_EXCLUDED_WARNING_CODE = "EVENT_PAST_ONLY_EXCLUDED";

function isPastOnlyExcludedEvent(warnings: readonly MigrationWarning[] | undefined): boolean {
  return (warnings ?? []).some((warning) => warning.code === EVENT_PAST_ONLY_EXCLUDED_WARNING_CODE);
}

export function parseEventPostIdFromSourceRecordKey(sourceRecordKey: string): number | null {
  const match = EVENT_SOURCE_RECORD_KEY_PATTERN.exec(sourceRecordKey.trim());
  return match ? Number(match[1]) : null;
}

export interface EventMediaOnlyReprocessArgsGuardInput {
  entity: string;
  /** Count of `--source-record-key` occurrences in argv — not just whether one is present, so a mistaken second flag is caught rather than silently using the first. */
  sourceRecordKeyCount: number;
  mediaPolicyName: MediaPolicyName | undefined;
  /** The unrelated, unsafe-for-events `--force-reprocess` flag — must never be combined with this one. */
  forceReprocess: boolean;
}

export type EventMediaOnlyReprocessGuardResult = { ok: true } | { ok: false; reason: string };

/** Pure, synchronous — no I/O, testable without a DB/SSH connection. */
export function validateEventMediaOnlyReprocessArgs(
  input: EventMediaOnlyReprocessArgsGuardInput,
): EventMediaOnlyReprocessGuardResult {
  if (input.entity !== "event") {
    return { ok: false, reason: "--force-media-reprocess requires --entity event." };
  }
  if (input.sourceRecordKeyCount !== 1) {
    return {
      ok: false,
      reason: `--force-media-reprocess requires exactly one --source-record-key (found ${input.sourceRecordKeyCount}).`,
    };
  }
  if (input.mediaPolicyName !== "FULL") {
    return { ok: false, reason: "--force-media-reprocess requires --media-policy FULL." };
  }
  if (input.forceReprocess) {
    return { ok: false, reason: "--force-media-reprocess cannot be combined with --force-reprocess." };
  }
  return { ok: true };
}

export interface EventMediaOnlyReprocessLineageLike {
  sourceId: string;
  isActive: boolean;
  targetId: string | null;
  lastSourceHash: string | null;
}

export interface EventMediaOnlyReprocessRuntimeGuardInput {
  bundle: WordPressEventBundle | null;
  lineage: EventMediaOnlyReprocessLineageLike | null;
  targetExists: boolean;
  /** Injectable clock, purely for deterministic tests — defaults to `new Date()`. */
  now?: Date;
}

export type EventMediaOnlyReprocessRuntimeGuardResult =
  | { ok: true; freshHash: string; candidate: NormalizedEventCandidate }
  | { ok: false; reason: string };

/**
 * The hash-equality check is load-bearing: it is what makes this replay
 * provably media-only. If the live source has drifted at all since the
 * hash was last recorded, this refuses — a domain-content change must go
 * through a real, reviewed UPDATE, never through this path.
 */
export function validateEventMediaOnlyReprocessRuntime(
  input: EventMediaOnlyReprocessRuntimeGuardInput,
): EventMediaOnlyReprocessRuntimeGuardResult {
  if (!input.bundle) {
    return { ok: false, reason: "No live published WordPress event found for this sourceRecordKey (source missing or not eligible)." };
  }
  if (!input.lineage || !input.lineage.isActive) {
    return { ok: false, reason: "No active ACTIVITY lineage found for this sourceRecordKey." };
  }
  if (!input.lineage.targetId || !input.targetExists) {
    return { ok: false, reason: "Target Activity not found for this lineage." };
  }
  const storedHash = input.lineage.lastSourceHash;
  if (!storedHash || !storedHash.startsWith(`${CANONICAL_SOURCE_HASH_VERSION}:`)) {
    return {
      ok: false,
      reason: `Stored lineage hash is not in canonical ${CANONICAL_SOURCE_HASH_VERSION} format — run the hash backfill first.`,
    };
  }
  const freshHash = hashEventBundle(input.bundle);
  if (freshHash !== storedHash) {
    return {
      ok: false,
      reason: "Freshly computed canonical hash does not match the stored lineage hash — domain source drift detected; refusing a media-only replay.",
    };
  }
  const normalized = normalizeEvent(input.bundle, { now: input.now ?? new Date() });
  if (isPastOnlyExcludedEvent(normalized.warnings)) {
    return {
      ok: false,
      reason:
        "Source Event is past-only (every event_date session is in the past relative to the migration clock) — Phoenix v1 excludes past-only Events entirely; media-only replay refused.",
    };
  }
  return { ok: true, freshHash, candidate: normalized.normalizedPayload as NormalizedEventCandidate };
}

export interface RunEventMediaOnlyReprocessInput {
  sourceId: string;
  sourceRecordKey: string;
  activityId: string;
  ownerUserId: string | null | undefined;
  candidate: NormalizedEventCandidate;
  freshHash: string;
  current: StrictEventMediaReplayCurrentState;
  mediaImporter: StrictEventMediaImporter;
  prisma: StrictEventMediaReplayPrismaClient;
}

/**
 * The entire allowed write surface of this module: delegates to
 * `runStrictEventMediaReplay()` — no `EventCommitRunner`, no
 * `ActivitySession`/`EventVenue` write, no `MigrationLineage(ACTIVITY)`
 * update, and (per that module) no write at all unless every required
 * attachment resolved successfully and no existing target media is of
 * unproven origin.
 */
export async function runEventMediaOnlyReprocess(
  input: RunEventMediaOnlyReprocessInput,
): Promise<StrictEventMediaReplayResult> {
  return runStrictEventMediaReplay({
    activityId: input.activityId,
    candidate: input.candidate,
    ownerUserId: input.ownerUserId,
    sourceId: input.sourceId,
    sourceHash: input.freshHash,
    current: input.current,
    mediaImporter: input.mediaImporter,
    prisma: input.prisma,
  });
}

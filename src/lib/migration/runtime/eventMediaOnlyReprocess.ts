/**
 * A narrow, deliberately separate replay path for a single Event's media
 * only — added because the generic `--force-reprocess` flag is unsafe here:
 * it flips a plan item to `UPDATE`, which sends the record through
 * `EventCommitRunner`'s real UPDATE path, and that path deletes/recreates
 * `ActivitySession` rows and re-upserts `EventVenue` (see
 * `docs/migration/prelaunch-checklist.md`, Event UPDATE-safety finding,
 * 2026-07-20). Recovering one skipped cover image is not worth that blast
 * radius. This module never touches `EventCommitRunner`, `Activity` domain
 * fields, `ActivitySession`, `EventVenue`, or `MigrationLineage(ACTIVITY)` —
 * it only ever calls the existing `EventMediaSyncerLike.sync()`, the exact
 * same media path a normal Event UPDATE would use, in isolation.
 *
 * Two guard layers:
 * - `validateEventMediaOnlyReprocessArgs()` — pure, synchronous, CLI-flag-only
 *   checks (entity/source-record-key count/media-policy/conflicting flags).
 * - `validateEventMediaOnlyReprocessRuntime()` — needs a live source fetch +
 *   lineage/target lookup; the hash-equality check is the one that matters
 *   most: this replay is only ever allowed when the freshly computed
 *   canonical hash is byte-identical to the stored lineage hash, i.e. there
 *   is zero possibility of a domain-content change riding along with the
 *   media fix.
 */
import { CANONICAL_SOURCE_HASH_VERSION, hashEventBundle } from "../adapters/wordpress-db/canonicalSourceHash";
import { normalizeEvent } from "../adapters/wordpress-db/normalizeEvent";
import type { WordPressEventBundle } from "../adapters/wordpress-db/types";
import type { EventMediaSyncerLike } from "../commit/event/EventCommitRunner";
import type { NormalizedEventCandidate } from "../commit/event/types";
import type { MigrationWarning } from "../types";
import type { MediaPolicyName } from "./MigrationProfile";

const EVENT_SOURCE_RECORD_KEY_PATTERN = /^wordpress-db:events:(\d+)$/;

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
  return { ok: true, freshHash, candidate: normalized.normalizedPayload as NormalizedEventCandidate };
}

export interface RunEventMediaOnlyReprocessInput {
  sourceId: string;
  sourceRecordKey: string;
  activityId: string;
  ownerUserId: string | null | undefined;
  candidate: NormalizedEventCandidate;
  freshHash: string;
  mediaSyncer: EventMediaSyncerLike;
}

/**
 * The entire allowed write surface of this module: one call into the
 * existing, already-idempotent `EventMediaSyncerLike.sync()` — no
 * `EventCommitRunner`, no `ActivitySession`/`EventVenue` write, no
 * `MigrationLineage(ACTIVITY)` update. `runId`/`recordId` are passed as
 * `null` deliberately: this is a standalone replay, not part of any
 * `MigrationRun`, and `EventMediaSyncer`'s own `EventMediaSyncInput` already
 * declares both fields optional/nullable for exactly this kind of one-off
 * call.
 */
export async function runEventMediaOnlyReprocess(
  input: RunEventMediaOnlyReprocessInput,
): Promise<{ warnings: MigrationWarning[] }> {
  return input.mediaSyncer.sync({
    activityId: input.activityId,
    candidate: input.candidate,
    ownerUserId: input.ownerUserId,
    sourceId: input.sourceId,
    sourceHash: input.freshHash,
    runId: null,
    recordId: null,
    sourceRecordKey: input.sourceRecordKey,
  });
}

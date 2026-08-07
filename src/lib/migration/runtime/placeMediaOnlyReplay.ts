/**
 * A narrow, deliberately separate replay path for a single Place's media
 * only — mirrors `eventMediaOnlyReprocess.ts`'s reason for existing
 * (`--force-reprocess` is unsafe for Place: it flips a plan item to
 * `UPDATE`, which sends the record through the full content-commit path).
 *
 * Place is simpler than Event/Article here and does not need a "strict"
 * transactional replay wrapper: `PlaceMediaSyncer.sync()` is already
 * non-destructive by construction — it never deletes an existing
 * `PlaceImage` row, only creates a new one or corrects `sortOrder` on a row
 * it recognizes (matched by URL), and it never writes to the `Place` row
 * itself (no `prisma.place.update()` anywhere in that class — confirmed by
 * reading it). So this module never touches `PlaceCommitRunner`,
 * `classifyPlaceUpdateSafety`, or any `Place` content field
 * (title/slug/address/coordinates/status/ownership) — it only ever calls
 * `PlaceMediaSyncer.sync()` directly, which is itself scoped to
 * `PlaceImage`/`MediaAsset`/`MigrationLineage(MEDIA_ASSET)` writes.
 *
 * Identity/mapping verification before any write: an active `PLACE`
 * `MigrationLineage` row must exist for the given `sourceRecordKey`, its
 * `targetId` must resolve to a real `Place` row, and the WordPress source
 * must still be live/published — same three checks
 * `validateEventMediaOnlyReprocessRuntime` performs for Event, minus the
 * hash-equality check (irrelevant here: this path never risks overwriting
 * content, so there's nothing content-drift-sensitive to prove).
 */
import { normalizePlace } from "../adapters/wordpress-db/normalizePlace";
import type { WordPressPlaceBundle } from "../adapters/wordpress-db/types";
import type { NormalizedPlaceCandidate } from "../commit/place/types";
import type { PlaceMediaSyncInput, PlaceMediaSyncResult } from "../commit/place/PlaceMediaSyncer";
import type { MediaPolicyName } from "./MigrationProfile";

const PLACE_SOURCE_RECORD_KEY_PATTERN = /^wordpress-db:places:([1-9]\d*)$/;

export function parsePlacePostIdFromSourceRecordKey(sourceRecordKey: string): number | null {
  const match = PLACE_SOURCE_RECORD_KEY_PATTERN.exec(sourceRecordKey.trim());
  return match ? Number(match[1]) : null;
}

export interface PlaceMediaOnlyReplayArgsGuardInput {
  entity: string;
  /** Count of `--source-record-key` occurrences in argv — catches a mistaken second flag rather than silently using the first. */
  sourceRecordKeyCount: number;
  mediaPolicyName: MediaPolicyName | undefined;
  /** Unrelated, unsafe-for-Place flags — must never be combined with this one. */
  forceReprocess: boolean;
  forceMediaReprocess: boolean;
  forceArticleMediaReplay: boolean;
}

export type PlaceMediaOnlyReplayGuardResult = { ok: true } | { ok: false; reason: string };

/** Pure, synchronous — no I/O, testable without a DB/SSH connection. */
export function validatePlaceMediaOnlyReplayArgs(input: PlaceMediaOnlyReplayArgsGuardInput): PlaceMediaOnlyReplayGuardResult {
  if (input.entity !== "place") {
    return { ok: false, reason: "--force-place-media-replay requires --entity place." };
  }
  if (input.sourceRecordKeyCount !== 1) {
    return {
      ok: false,
      reason: `--force-place-media-replay requires exactly one --source-record-key (found ${input.sourceRecordKeyCount}).`,
    };
  }
  if (input.mediaPolicyName !== "FULL") {
    return { ok: false, reason: "--force-place-media-replay requires --media-policy FULL." };
  }
  if (input.forceReprocess || input.forceMediaReprocess || input.forceArticleMediaReplay) {
    return {
      ok: false,
      reason: "--force-place-media-replay cannot be combined with --force-reprocess/--force-media-reprocess/--force-article-media-replay.",
    };
  }
  return { ok: true };
}

export interface PlaceMediaOnlyReplayLineageLike {
  sourceId: string;
  isActive: boolean;
  targetId: string | null;
}

export interface PlaceMediaOnlyReplayRuntimeGuardInput {
  bundle: WordPressPlaceBundle | null;
  lineage: PlaceMediaOnlyReplayLineageLike | null;
  targetExists: boolean;
}

export type PlaceMediaOnlyReplayRuntimeGuardResult =
  | { ok: true; candidate: NormalizedPlaceCandidate }
  | { ok: false; reason: string };

export function validatePlaceMediaOnlyReplayRuntime(
  input: PlaceMediaOnlyReplayRuntimeGuardInput,
): PlaceMediaOnlyReplayRuntimeGuardResult {
  if (!input.bundle) {
    return { ok: false, reason: "No live published WordPress place found for this sourceRecordKey (source missing or not eligible)." };
  }
  if (!input.lineage || !input.lineage.isActive) {
    return { ok: false, reason: "No active PLACE lineage found for this sourceRecordKey." };
  }
  if (!input.lineage.targetId || !input.targetExists) {
    return { ok: false, reason: "Target Place not found for this lineage." };
  }
  const normalized = normalizePlace(input.bundle);
  return { ok: true, candidate: normalized.normalizedPayload as NormalizedPlaceCandidate };
}

export interface PlaceMediaOnlyReplayer {
  sync(input: PlaceMediaSyncInput): Promise<PlaceMediaSyncResult>;
}

export interface RunPlaceMediaOnlyReplayInput {
  sourceId: string;
  sourceRecordKey: string;
  placeId: string;
  ownerUserId: string | null | undefined;
  candidate: NormalizedPlaceCandidate;
  sourceHash: string | null;
  mediaSyncer: PlaceMediaOnlyReplayer;
}

export type PlaceMediaOnlyReplayResult =
  | { status: "APPLIED"; imported: number; reused: number; skipped: number; failed: number }
  | { status: "NOOP_ALREADY_SYNCED"; reused: number; skipped: number }
  | { status: "PARTIAL"; imported: number; reused: number; skipped: number; failed: number }
  | { status: "REFUSED"; code: string; message: string };

/**
 * The entire allowed write surface of this module: delegates to
 * `PlaceMediaSyncer.sync()` — no `PlaceCommitRunner`, no `Place` content
 * field write, no `classifyPlaceUpdateSafety` check. A partial failure
 * (some source attachments genuinely gone) is reported as `PARTIAL`, not
 * refused — mirrors `PlaceMediaSyncer`'s own "the commit remains
 * successful with partial media" posture; never force a record whose
 * source media no longer exists.
 */
export async function runPlaceMediaOnlyReplay(input: RunPlaceMediaOnlyReplayInput): Promise<PlaceMediaOnlyReplayResult> {
  const hasThumbnail = input.candidate.media.thumbnailAttachmentId !== null;
  const hasGallery = input.candidate.media.galleryAttachmentIds.length > 0;
  if (!hasThumbnail && !hasGallery) {
    return {
      status: "REFUSED",
      code: "PLACE_MEDIA_ONLY_SOURCE_MEDIA_MISSING",
      message: "Source candidate has no thumbnail and no gallery attachments — there is no media to replay.",
    };
  }

  const ownerUserId = input.ownerUserId?.trim();
  if (!ownerUserId) {
    return {
      status: "REFUSED",
      code: "PLACE_MEDIA_OWNER_MISSING",
      message: "No ownerUserId (Place.createdByUserId) available for migrated MediaAsset ownership.",
    };
  }

  const result = await input.mediaSyncer.sync({
    placeId: input.placeId,
    candidate: input.candidate,
    uploadedByUserId: ownerUserId,
    sourceId: input.sourceId,
    sourceHash: input.sourceHash,
    runId: null,
    recordId: null,
    sourceRecordKey: input.sourceRecordKey,
  });

  if (result.imported === 0 && result.failed === 0) {
    return { status: "NOOP_ALREADY_SYNCED", reused: result.reused, skipped: result.skipped };
  }
  if (result.failed > 0) {
    return { status: "PARTIAL", imported: result.imported, reused: result.reused, skipped: result.skipped, failed: result.failed };
  }
  return { status: "APPLIED", imported: result.imported, reused: result.reused, skipped: result.skipped, failed: result.failed };
}

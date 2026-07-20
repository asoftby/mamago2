/**
 * Fail-closed, non-destructive, atomic Event media replay.
 *
 * `EventMediaSyncer.sync()` has destructive-replacement semantics that are
 * correct for a real commit (source is the trusted, complete truth at that
 * moment) but unsafe for a standalone recovery replay: an empty source
 * media list clears the existing cover/gallery, a missing attachment/
 * invalid URL/download failure degrades to a `WARNING` and continues, and
 * the cover is unconditionally rewritten (to `null` on failure) while the
 * gallery is unconditionally replaced with whatever subset *did* import
 * successfully.
 *
 * Round 2 review fix: round 1 of this module ran
 * `resolveAndImportAttachments()` (which can create `MediaAsset`/
 * `MigrationLineage(MEDIA_ASSET)` rows and download files) *before*
 * checking whether the existing target cover/gallery's origin could be
 * proven — so a REFUSED-due-to-divergence result could still leave media
 * side effects behind. This version proves target-media provenance in a
 * genuine read-only preflight, using *only* already-committed
 * `MigrationLineage(MEDIA_ASSET)` rows (`findExistingMediaAssets()` —
 * never an import attempt), before any write of any kind. It also applies
 * the final cover+gallery write in one Prisma transaction with a
 * concurrency guard that re-checks the target hasn't changed since
 * preflight, so a partial gallery failure (or a concurrent manual edit)
 * can never leave `Activity`/`ActivityImage` in a mixed state.
 *
 * Reuses `EventMediaSyncer.findExistingMediaAssets()`/
 * `resolveAndImportAttachments()` for all attachment-level work — no
 * second implementation of that logic.
 */
import type { PrismaClient } from "@prisma/client";
import { replaceActivityGalleryFromMediaIds } from "@/lib/business/syncEventGalleryFromMediaIds";
import type { AttachmentImportOutcome, ResolveAndImportAttachmentsInput } from "../commit/event/EventMediaSyncer";
import { uniqueAttachmentIds } from "../commit/event/EventMediaSyncer";
import type { NormalizedEventCandidate } from "../commit/event/types";

export interface StrictEventMediaImporter {
  findExistingMediaAssets(input: { ids: readonly number[]; sourceId: string }): Promise<Map<number, { mediaId: string; publicUrl: string }>>;
  resolveAndImportAttachments(input: ResolveAndImportAttachmentsInput): Promise<Map<number, AttachmentImportOutcome>>;
}

/** The narrow slice of Prisma needed for the final atomic apply — shape-compatible with both a real `PrismaClient` and its `$transaction` callback argument. */
export interface StrictEventMediaReplayTxClient {
  activity: Pick<PrismaClient["activity"], "update" | "findUnique">;
  activityImage: Pick<PrismaClient["activityImage"], "create" | "deleteMany" | "findMany">;
  mediaAsset: Pick<PrismaClient["mediaAsset"], "findFirst">;
}

export interface StrictEventMediaReplayPrismaClient extends StrictEventMediaReplayTxClient {
  $transaction<T>(fn: (tx: StrictEventMediaReplayTxClient) => Promise<T>): Promise<T>;
}

/** Caller-supplied snapshot of the target's *current* media state, taken immediately before calling this function. `galleryMediaAssetIds` must be in current `sortOrder` ascending order. */
export interface StrictEventMediaReplayCurrentState {
  coverImageId: string | null;
  galleryMediaAssetIds: readonly (string | null)[];
}

export interface RunStrictEventMediaReplayInput {
  activityId: string;
  candidate: NormalizedEventCandidate;
  ownerUserId: string | null | undefined;
  sourceId: string;
  sourceHash: string;
  current: StrictEventMediaReplayCurrentState;
  mediaImporter: StrictEventMediaImporter;
  prisma: StrictEventMediaReplayPrismaClient;
}

export interface AttachmentFailure {
  attachmentId: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type StrictEventMediaReplayResult =
  | {
      status: "APPLIED";
      coverMediaId: string | null;
      galleryMediaIds: readonly string[];
      reusedAttachmentIds: readonly number[];
      importedAttachmentIds: readonly number[];
    }
  | { status: "NOOP_ALREADY_SYNCED"; coverMediaId: string | null; galleryMediaIds: readonly string[] }
  | { status: "REFUSED"; code: string; message: string; details?: Record<string, unknown> }
  | { status: "FAILED"; code: string; message: string; failures: readonly AttachmentFailure[] };

function isOk(outcome: AttachmentImportOutcome): outcome is Extract<AttachmentImportOutcome, { ok: true }> {
  return outcome.ok;
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

class TargetChangedDuringReplayError extends Error {}

export async function runStrictEventMediaReplay(
  input: RunStrictEventMediaReplayInput,
): Promise<StrictEventMediaReplayResult> {
  const ids = uniqueAttachmentIds(input.candidate);
  if (ids.length === 0) {
    return {
      status: "REFUSED",
      code: "EVENT_MEDIA_ONLY_SOURCE_MEDIA_MISSING",
      message: "Source candidate has no featuredAttachmentId and no galleryAttachmentIds — there is no media to replay.",
    };
  }

  const ownerUserId = input.ownerUserId?.trim();
  if (!ownerUserId) {
    return {
      status: "REFUSED",
      code: "EVENT_MEDIA_OWNER_MISSING",
      message: "No ownerUserId available for migrated MediaAsset ownership.",
    };
  }

  const featuredAttachmentId = input.candidate.media?.featuredAttachmentId ?? null;
  const galleryAttachmentIds = input.candidate.media?.galleryAttachmentIds ?? [];

  // --- Read-only preflight: prove existing target media's origin using
  // only already-committed MEDIA_ASSET lineage — no import attempt, no
  // write of any kind, so a REFUSED result here has zero side effects. ---
  const provenMap = await input.mediaImporter.findExistingMediaAssets({ ids, sourceId: input.sourceId });

  const coverProven = featuredAttachmentId === null || provenMap.has(featuredAttachmentId);
  const provenCoverMediaId = featuredAttachmentId !== null ? provenMap.get(featuredAttachmentId)?.mediaId ?? null : null;
  const galleryProvenIds = galleryAttachmentIds.map((id) => provenMap.get(id)?.mediaId ?? null);
  const galleryFullyProven = galleryProvenIds.every((id) => id !== null);

  if (input.current.coverImageId !== null) {
    if (!coverProven || input.current.coverImageId !== provenCoverMediaId) {
      return {
        status: "REFUSED",
        code: "EVENT_MEDIA_ONLY_TARGET_MEDIA_DIVERGENCE",
        message: "Existing Activity cover's origin cannot be proven from current source media — refusing before any import.",
        details: { field: "cover", currentCoverImageId: input.current.coverImageId, provenCoverMediaId: coverProven ? provenCoverMediaId : "UNPROVEN" },
      };
    }
  }
  if (input.current.galleryMediaAssetIds.length > 0) {
    if (!galleryFullyProven || !arraysEqual(input.current.galleryMediaAssetIds, galleryProvenIds)) {
      return {
        status: "REFUSED",
        code: "EVENT_MEDIA_ONLY_TARGET_MEDIA_DIVERGENCE",
        message: "Existing Activity gallery's origin cannot be fully proven from current source media — refusing before any import.",
        details: { field: "gallery", current: input.current.galleryMediaAssetIds, proven: galleryProvenIds },
      };
    }
  }

  const coverSyncedOrNotNeeded =
    featuredAttachmentId === null ? input.current.coverImageId === null : input.current.coverImageId !== null && input.current.coverImageId === provenCoverMediaId;
  const gallerySyncedOrNotNeeded =
    galleryAttachmentIds.length === 0
      ? input.current.galleryMediaAssetIds.length === 0
      : input.current.galleryMediaAssetIds.length > 0 && arraysEqual(input.current.galleryMediaAssetIds, galleryProvenIds);

  if (coverSyncedOrNotNeeded && gallerySyncedOrNotNeeded) {
    // Already fully synced, proven from existing lineage alone — no
    // import/download attempt needed at all.
    return {
      status: "NOOP_ALREADY_SYNCED",
      coverMediaId: provenCoverMediaId,
      galleryMediaIds: galleryProvenIds as string[],
    };
  }

  // --- Import phase: only reached once preflight has proven the current
  // target is either empty or fully matches existing source media. ---
  const outcomes = await input.mediaImporter.resolveAndImportAttachments({
    ids,
    ownerUserId,
    sourceId: input.sourceId,
    sourceHash: input.sourceHash,
    runId: null,
    recordId: null,
    featuredAttachmentId,
  });

  const failures: AttachmentFailure[] = [];
  for (const [attachmentId, outcome] of outcomes) {
    if (!outcome.ok) {
      failures.push({ attachmentId, code: outcome.code, message: outcome.message, details: outcome.details });
    }
  }
  if (failures.length > 0) {
    return {
      status: "FAILED",
      code: "EVENT_MEDIA_ONLY_IMPORT_INCOMPLETE",
      message:
        "One or more required attachments could not be resolved or imported — Activity cover and gallery were left untouched. Already-created MediaAsset/MEDIA_ASSET lineage rows (if any) are safe to leave in place for an idempotent retry.",
      failures,
    };
  }

  const resolvedCover = featuredAttachmentId !== null ? outcomes.get(featuredAttachmentId) : undefined;
  const resolvedCoverMediaId = resolvedCover && isOk(resolvedCover) ? resolvedCover.mediaId : null;
  const resolvedCoverPublicUrl = resolvedCover && isOk(resolvedCover) ? resolvedCover.publicUrl : null;
  const resolvedGalleryMediaIds = galleryAttachmentIds.map((id) => {
    const outcome = outcomes.get(id);
    return outcome && isOk(outcome) ? outcome.mediaId : null;
  }) as string[]; // every id succeeded — failures already returned above.

  // --- Atomic apply, with a concurrency guard re-proving the target
  // hasn't changed since preflight (e.g. a concurrent manual edit). File
  // downloads already happened above, outside this transaction — only the
  // final DB write is transactional. ---
  try {
    await input.prisma.$transaction(async (tx) => {
      const liveActivity = await tx.activity.findUnique({ where: { id: input.activityId }, select: { coverImageId: true } });
      const liveImages = await tx.activityImage.findMany({
        where: { activityId: input.activityId },
        orderBy: { sortOrder: "asc" },
        select: { mediaAssetId: true },
      });
      const liveGalleryIds = liveImages.map((image) => image.mediaAssetId);
      if ((liveActivity?.coverImageId ?? null) !== input.current.coverImageId || !arraysEqual(liveGalleryIds, input.current.galleryMediaAssetIds)) {
        throw new TargetChangedDuringReplayError();
      }

      await tx.activity.update({
        where: { id: input.activityId },
        data: { coverImageId: resolvedCoverMediaId, coverImageUrl: resolvedCoverPublicUrl },
      });
      await replaceActivityGalleryFromMediaIds({
        prisma: tx,
        activityId: input.activityId,
        rawMediaIds: resolvedGalleryMediaIds,
        coverMediaId: resolvedCoverMediaId,
      });
    });
  } catch (error) {
    if (error instanceof TargetChangedDuringReplayError) {
      return {
        status: "REFUSED",
        code: "EVENT_MEDIA_ONLY_TARGET_CHANGED_DURING_REPLAY",
        message: "Activity cover/gallery changed between preflight and apply — refusing to overwrite a concurrent edit. The transaction was rolled back.",
      };
    }
    throw error;
  }

  const reusedAttachmentIds = ids.filter((id) => {
    const outcome = outcomes.get(id);
    return outcome && isOk(outcome) && outcome.reused;
  });
  const importedAttachmentIds = ids.filter((id) => {
    const outcome = outcomes.get(id);
    return outcome && isOk(outcome) && !outcome.reused;
  });

  return {
    status: "APPLIED",
    coverMediaId: resolvedCoverMediaId,
    galleryMediaIds: resolvedGalleryMediaIds,
    reusedAttachmentIds,
    importedAttachmentIds,
  };
}

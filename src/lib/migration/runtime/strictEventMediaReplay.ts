/**
 * Fail-closed, non-destructive Event media replay.
 *
 * `EventMediaSyncer.sync()` has destructive-replacement semantics that are
 * correct for a real commit (source is the trusted, complete truth at that
 * moment) but unsafe for a standalone recovery replay: an empty source
 * media list clears the existing cover/gallery, a missing attachment/
 * invalid URL/download failure degrades to a `WARNING` and continues, and
 * the cover is unconditionally rewritten (to `null` on failure) while the
 * gallery is unconditionally replaced with whatever subset *did* import
 * successfully. A transient download hiccup or a partially-successful
 * gallery import can silently delete media that was there before — for a
 * one-off "go recover this cover image" tool, that is not acceptable.
 *
 * This module never touches `Activity`/`ActivityImage` until every
 * required attachment has been resolved (imported or reused) successfully,
 * and refuses outright rather than overwrite any existing cover/gallery
 * media whose origin doesn't provably match the current source media set.
 * It reuses `EventMediaSyncer.resolveAndImportAttachments()` for the
 * attachment-level import/reuse/dedup logic — no second implementation of
 * that.
 */
import { replaceActivityGalleryFromMediaIds } from "@/lib/business/syncEventGalleryFromMediaIds";
import type { PrismaClient } from "@prisma/client";
import type { AttachmentImportOutcome, ResolveAndImportAttachmentsInput } from "../commit/event/EventMediaSyncer";
import { uniqueAttachmentIds } from "../commit/event/EventMediaSyncer";
import type { NormalizedEventCandidate } from "../commit/event/types";

export interface StrictEventMediaImporter {
  resolveAndImportAttachments(input: ResolveAndImportAttachmentsInput): Promise<Map<number, AttachmentImportOutcome>>;
}

export interface StrictEventMediaReplayPrismaClient {
  activity: Pick<PrismaClient["activity"], "update">;
  activityImage: Pick<PrismaClient["activityImage"], "create" | "deleteMany" | "findMany">;
  mediaAsset: Pick<PrismaClient["mediaAsset"], "findFirst">;
}

/** Caller-supplied snapshot of the target's *current* media state, taken before any write. `galleryMediaAssetIds` must be in current `sortOrder` ascending order. */
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
  });
  // Every id in `galleryAttachmentIds` came from `ids`, and every id in
  // `ids` has a successful outcome at this point (failures already
  // returned above) — so every entry here is guaranteed non-null.
  const resolvedGalleryMediaIdsChecked = resolvedGalleryMediaIds as string[];

  // --- Target divergence checks — never silently overwrite unproven media. ---
  if (input.current.coverImageId !== null && input.current.coverImageId !== resolvedCoverMediaId) {
    return {
      status: "REFUSED",
      code: "EVENT_MEDIA_ONLY_TARGET_MEDIA_DIVERGENCE",
      message: "Existing Activity cover does not match the resolved source cover media — refusing to overwrite an unproven target.",
      details: { field: "cover", currentCoverImageId: input.current.coverImageId, resolvedCoverMediaId },
    };
  }
  const resolvedGallerySet = new Set(resolvedGalleryMediaIdsChecked);
  const foreignGalleryIds = input.current.galleryMediaAssetIds.filter((id) => id === null || !resolvedGallerySet.has(id));
  if (foreignGalleryIds.length > 0) {
    return {
      status: "REFUSED",
      code: "EVENT_MEDIA_ONLY_TARGET_MEDIA_DIVERGENCE",
      message: "Existing Activity gallery contains media not present in the resolved source gallery — refusing to overwrite an unproven target.",
      details: { field: "gallery", foreignMediaAssetIds: foreignGalleryIds },
    };
  }

  const coverAlreadySynced = input.current.coverImageId === resolvedCoverMediaId;
  const galleryAlreadySynced =
    input.current.galleryMediaAssetIds.length === resolvedGalleryMediaIdsChecked.length &&
    input.current.galleryMediaAssetIds.every((id, index) => id === resolvedGalleryMediaIdsChecked[index]);

  if (coverAlreadySynced && galleryAlreadySynced) {
    return { status: "NOOP_ALREADY_SYNCED", coverMediaId: resolvedCoverMediaId, galleryMediaIds: resolvedGalleryMediaIdsChecked };
  }

  await input.prisma.activity.update({
    where: { id: input.activityId },
    data: { coverImageId: resolvedCoverMediaId, coverImageUrl: resolvedCoverPublicUrl },
  });
  await replaceActivityGalleryFromMediaIds({
    prisma: input.prisma,
    activityId: input.activityId,
    rawMediaIds: resolvedGalleryMediaIdsChecked,
    coverMediaId: resolvedCoverMediaId,
  });

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
    galleryMediaIds: resolvedGalleryMediaIdsChecked,
    reusedAttachmentIds,
    importedAttachmentIds,
  };
}

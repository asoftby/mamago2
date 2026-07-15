import type { PrismaClient } from "@prisma/client";

import type { MigrationWarning } from "../../types";
import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";
import { buildWordPressAttachmentSourceRecordKey } from "../../place-media/attachmentSourceRecordKey";
import { MediaImportWriter } from "../../media/MediaImportWriter";
import type { MediaImporterLike, MediaLineageWriterLike } from "../../media/types";
import type { NormalizedPlaceCandidate } from "./types";

/**
 * A single, fixed `targetRole` for every Place media lineage row —
 * deliberately NOT "cover"/"gallery" per attachment the way
 * `EventMediaSyncer` does. Read-only audit (2026-07-15, all 82 published
 * Places) found real attachment ids that are `cover` for one Place and
 * `gallery` for another (e.g. attachment 32649: cover for Places 32633/
 * 32636, gallery for Place 32637) — `MigrationLineage`'s unique constraint
 * is `(sourceId, sourceRecordKey, targetType, targetRole)`, so a
 * role-specific key would create two lineage rows (and download the same
 * file twice) for one physical attachment. A single constant role keeps
 * "same attachment id -> one MediaAsset" true across Places, not just
 * within one Place.
 */
const PLACE_MEDIA_TARGET_ROLE = "place-media";

export interface PlaceMediaAttachmentResolver {
  getAttachmentsByIds(ids: readonly number[]): Promise<Map<number, WordPressAttachmentRow>>;
}

export interface PlaceMediaSyncerPrismaClient {
  placeImage: Pick<PrismaClient["placeImage"], "create" | "findMany" | "update">;
  mediaAsset: Pick<PrismaClient["mediaAsset"], "findFirst">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst">;
}

export interface PlaceMediaSyncInput {
  placeId: string;
  candidate: NormalizedPlaceCandidate;
  uploadedByUserId: string | null | undefined;
  sourceId: string;
  sourceHash: string | null;
  runId?: string | null;
  recordId?: string | null;
  sourceRecordKey: string;
}

/**
 * Per-attachment outcome counts across one `sync()` call:
 * - `imported`: a brand-new `MediaAsset` was downloaded and a new
 *   `PlaceImage` row created for it.
 * - `reused`: no download happened — either an existing `MediaAsset` was
 *   found via `MigrationLineage` and linked (a new `PlaceImage` row, still
 *   zero bytes downloaded — `PLACE_MEDIA_ASSET_REUSED`), or this Place
 *   already had a `PlaceImage` row pointing at that exact URL from a prior
 *   run (`PLACE_MEDIA_LINK_REUSED`, genuinely nothing written).
 * - `skipped`: deliberately never attempted — missing attachment row,
 *   unsupported/HEIC format, invalid URL.
 * - `failed`: an import was attempted and threw (network/processing error).
 */
export interface PlaceMediaSyncResult {
  warnings: MigrationWarning[];
  imported: number;
  reused: number;
  skipped: number;
  failed: number;
}

type ResolvedMedia = { mediaId: string; publicUrl: string; width: number | null; height: number | null };

function warning(
  sourceRecordKey: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  severity: MigrationWarning["severity"] = "WARNING",
): MigrationWarning {
  return { code, message, severity, sourceRecordKey, ...(details ? { details } : {}) };
}

/**
 * Cover-first, de-duplicated attachment id order: the cover attachment (if
 * any) is always first (so it lands at `PlaceImage.sortOrder: 0` — the
 * "first gallery image = cover" convention both the admin editor and the
 * public Place page already use, since `PlaceImageKind` has no `COVER`
 * value of its own). Real source data sometimes lists the cover id again
 * inside `galleryAttachmentIds` (confirmed on 11/82 Places, e.g. Place
 * 43023) — that duplicate is dropped here so the same photo is never
 * written as two separate `PlaceImage` rows.
 */
function orderedUniqueAttachmentIds(candidate: NormalizedPlaceCandidate): number[] {
  const { thumbnailAttachmentId, galleryAttachmentIds } = candidate.media;
  const ids: number[] = [];
  const seen = new Set<number>();
  if (thumbnailAttachmentId !== null) {
    ids.push(thumbnailAttachmentId);
    seen.add(thumbnailAttachmentId);
  }
  for (const id of galleryAttachmentIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function isUsableHttpUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isHeicMime(mime: string): boolean {
  const lower = mime.toLowerCase();
  return lower === "image/heic" || lower === "image/heif";
}

function classifyImportError(message: string): "PLACE_MEDIA_DOWNLOAD_FAILED" | "PLACE_MEDIA_PROCESS_FAILED" {
  if (/failed to download|exceeds the maximum allowed size|http \d+/i.test(message)) {
    return "PLACE_MEDIA_DOWNLOAD_FAILED";
  }
  return "PLACE_MEDIA_PROCESS_FAILED";
}

/**
 * Imports/reuses a Place's cover + gallery attachments as `MediaAsset`s and
 * links them as `PlaceImage(kind: "GALLERY")` rows, cover first. Mirrors
 * `EventMediaSyncer`/`RouteStopMediaSyncer`'s import-or-reuse-via-lineage
 * pattern, with two deliberate Place-specific differences:
 *
 * 1. A single fixed lineage `targetRole` (see `PLACE_MEDIA_TARGET_ROLE`)
 *    instead of per-attachment "cover"/"gallery", because real Place
 *    attachment ids are sometimes cover for one Place and gallery for
 *    another.
 * 2. Never deletes an existing `PlaceImage` row, and never touches a row
 *    it doesn't recognize. Event's syncer does a diff-then-`deleteMany`+
 *    recreate; Place has no equivalent "safe to fully replace" guarantee
 *    (`PlaceImage` has no `mediaAssetId` FK to diff against, and
 *    manually-added images — e.g. Place 437, which this syncer must never
 *    even be called for — must never be silently removed by a re-run).
 *    A row is only ever created or have its `sortOrder` corrected when its
 *    `url` matches a `MediaAsset` this exact call just resolved for one of
 *    the candidate's own attachment ids — an unrelated/manual row (a
 *    different URL) is never matched, so it's never written to. `sortOrder`
 *    is assigned by each attachment's fixed position in the cover-first,
 *    source-ordered list (`orderedUniqueAttachmentIds`), not "whatever
 *    slot is next free" — a `--force-reprocess` retry can resolve an
 *    earlier attachment (e.g. the cover) after later gallery items already
 *    succeeded on a prior run, and a plain "append after max" scheme would
 *    silently move that recovered item to the back instead of restoring
 *    correct order.
 *
 * Never touches `Place.logoImageId` or creates a `PlaceImageKind.LOGO`
 * row — Place logo import is a permanent, separate policy exclusion (see
 * `PLACE_LOGO_EXCLUDED` in `normalizePlace.ts`), not something this PR
 * revisits.
 */
export class PlaceMediaSyncer {
  constructor(
    private readonly deps: {
      prisma: PlaceMediaSyncerPrismaClient;
      attachmentResolver: PlaceMediaAttachmentResolver;
      mediaImporterFactory: (uploadedByUserId: string) => MediaImporterLike;
      lineageWriter: MediaLineageWriterLike;
    },
  ) {}

  async sync(input: PlaceMediaSyncInput): Promise<PlaceMediaSyncResult> {
    const warnings: MigrationWarning[] = [];
    const counts = { imported: 0, reused: 0, skipped: 0, failed: 0 };

    const ids = orderedUniqueAttachmentIds(input.candidate);
    if (ids.length === 0) {
      return { warnings, ...counts };
    }

    const uploadedByUserId = input.uploadedByUserId?.trim();
    if (!uploadedByUserId) {
      warnings.push(
        warning(
          input.sourceRecordKey,
          "PLACE_MEDIA_OWNER_MISSING",
          "Place media was skipped because no uploadedByUserId was available for migrated MediaAsset ownership.",
          { attachmentIds: ids },
        ),
      );
      counts.skipped = ids.length;
      return { warnings, ...counts };
    }

    const [attachments, existingImages] = await Promise.all([
      this.deps.attachmentResolver.getAttachmentsByIds(ids),
      this.deps.prisma.placeImage.findMany({
        where: { placeId: input.placeId },
        select: { id: true, url: true, sortOrder: true },
      }),
    ]);

    // Keyed by URL, not attachment id — an existing row only ever matches
    // here if some earlier sync() call resolved the exact same MediaAsset
    // for one of *this* candidate's own attachment ids, so a genuinely
    // unrelated/manual PlaceImage (a different URL entirely) can never be
    // matched or touched by the block below.
    const existingByUrl = new Map(existingImages.map((row) => [row.url.trim(), row]));

    const importer = this.deps.mediaImporterFactory(uploadedByUserId);

    for (const [index, id] of ids.entries()) {
      // The attachment's position in `ids` (cover always 0, then gallery in
      // source order) *is* its correct sortOrder — not "whatever slot is
      // next free". A retry (`--force-reprocess`) can resolve an earlier
      // attachment (e.g. the cover) after later gallery items already
      // succeeded on a prior run; assigning by fixed index, and correcting
      // an already-linked row's sortOrder if it's since drifted, keeps
      // cover-first/source order correct regardless of which attempt each
      // attachment succeeded on. Found by review (PR #49,
      // chatgpt-codex-connector) before merge — a plain "append after max"
      // scheme silently moved a recovered cover/earlier item to the back.
      const targetSortOrder = index;
      const attachment = attachments.get(id);
      if (!attachment) {
        warnings.push(
          warning(input.sourceRecordKey, "PLACE_MEDIA_SOURCE_MISSING", "WordPress attachment row was not found.", {
            attachmentId: id,
          }),
        );
        counts.skipped++;
        continue;
      }

      if (isHeicMime(attachment.post_mime_type)) {
        warnings.push(
          warning(
            input.sourceRecordKey,
            "PLACE_MEDIA_HEIC_UNSUPPORTED",
            "HEIC/HEIF attachments cannot be processed server-side (sharp has no HEVC decoder); skipped without attempting a download.",
            { attachmentId: id, mimeType: attachment.post_mime_type },
          ),
        );
        counts.skipped++;
        continue;
      }
      if (!attachment.post_mime_type?.toLowerCase().startsWith("image/")) {
        warnings.push(
          warning(
            input.sourceRecordKey,
            "PLACE_MEDIA_FORMAT_UNSUPPORTED",
            "Attachment mime type is not a supported image format; skipped without attempting a download.",
            { attachmentId: id, mimeType: attachment.post_mime_type },
          ),
        );
        counts.skipped++;
        continue;
      }
      if (!isUsableHttpUrl(attachment.guid)) {
        warnings.push(
          warning(input.sourceRecordKey, "PLACE_MEDIA_SOURCE_MISSING", "WordPress attachment guid is not a valid http(s) URL.", {
            attachmentId: id,
            guid: attachment.guid,
          }),
        );
        counts.skipped++;
        continue;
      }

      const resolved = await this.importOrReuseAttachment({
        attachmentId: id,
        attachment,
        importer,
        sourceId: input.sourceId,
        sourceHash: input.sourceHash ?? input.sourceRecordKey,
        runId: input.runId ?? null,
        recordId: input.recordId ?? null,
        sourceRecordKey: input.sourceRecordKey,
        warnings,
        counts,
      });
      if (!resolved) continue;

      const url = resolved.publicUrl.trim();
      const existingRow = existingByUrl.get(url);
      if (existingRow) {
        if (existingRow.sortOrder !== targetSortOrder) {
          await this.deps.prisma.placeImage.update({
            where: { id: existingRow.id },
            data: { sortOrder: targetSortOrder },
          });
        }
        warnings.push(
          warning(
            input.sourceRecordKey,
            "PLACE_MEDIA_LINK_REUSED",
            "This Place already has a PlaceImage row for this attachment's MediaAsset; reused (sortOrder corrected if it had drifted).",
            { attachmentId: id, mediaAssetId: resolved.mediaId },
            "INFO",
          ),
        );
        continue;
      }

      const createdRow = await this.deps.prisma.placeImage.create({
        data: {
          placeId: input.placeId,
          kind: "GALLERY",
          url,
          width: resolved.width,
          height: resolved.height,
          sortOrder: targetSortOrder,
        },
      });
      existingByUrl.set(url, { id: createdRow.id, url, sortOrder: targetSortOrder });
    }

    if (counts.failed > 0) {
      warnings.push(
        warning(
          input.sourceRecordKey,
          "PLACE_MEDIA_PARTIAL",
          "One or more Place media attachments failed to import; the Place commit remains successful with partial media.",
          { imported: counts.imported, reused: counts.reused, skipped: counts.skipped, failed: counts.failed },
        ),
      );
    }

    return { warnings, ...counts };
  }

  private async importOrReuseAttachment(input: {
    attachmentId: number;
    attachment: WordPressAttachmentRow;
    importer: MediaImporterLike;
    sourceId: string;
    sourceHash: string;
    runId: string | null;
    recordId: string | null;
    sourceRecordKey: string;
    warnings: MigrationWarning[];
    counts: { imported: number; reused: number; skipped: number; failed: number };
  }): Promise<ResolvedMedia | null> {
    const attachmentSourceRecordKey = buildWordPressAttachmentSourceRecordKey(input.attachmentId);
    const existingLineage = await this.deps.prisma.migrationLineage.findFirst({
      where: {
        sourceId: input.sourceId,
        sourceRecordKey: attachmentSourceRecordKey,
        targetType: "MEDIA_ASSET",
        isActive: true,
      },
      select: { targetId: true },
    });
    if (existingLineage?.targetId) {
      const asset = await this.deps.prisma.mediaAsset.findFirst({
        where: { id: existingLineage.targetId, deletedAt: null },
        select: { id: true, publicUrl: true, width: true, height: true },
      });
      if (asset?.publicUrl?.trim()) {
        input.warnings.push(
          warning(
            input.sourceRecordKey,
            "PLACE_MEDIA_ASSET_REUSED",
            "Existing imported MediaAsset lineage was reused for Place media; no download attempted.",
            { attachmentId: input.attachmentId, mediaAssetId: asset.id },
            "INFO",
          ),
        );
        input.counts.reused++;
        return { mediaId: asset.id, publicUrl: asset.publicUrl.trim(), width: asset.width ?? null, height: asset.height ?? null };
      }
    }

    try {
      const writer = new MediaImportWriter({
        mediaImporter: input.importer,
        lineageWriter: this.deps.lineageWriter,
      });
      const result = await writer.importWordPressAttachment({
        attachment: input.attachment,
        sourceId: input.sourceId,
        sourceRecordKey: attachmentSourceRecordKey,
        sourceEntityType: "wordpress-db:attachment",
        sourceStableKey: `attachment:${input.attachmentId}`,
        sourceHash: input.sourceHash,
        targetRole: PLACE_MEDIA_TARGET_ROLE,
        runId: input.runId,
        recordId: input.recordId,
      });
      input.counts.imported++;
      input.warnings.push(
        warning(
          input.sourceRecordKey,
          "PLACE_MEDIA_IMPORTED",
          "Place media attachment was downloaded and imported as a new MediaAsset.",
          { attachmentId: input.attachmentId, mediaAssetId: result.mediaId },
          "INFO",
        ),
      );
      // `importWordPressAttachment`'s result doesn't carry width/height —
      // only `mediaId`/`lineageId`/`publicUrl`. Read them back off the
      // `MediaAsset` row `MediaImportWriter` just created so the new
      // `PlaceImage` row isn't left with null dimensions.
      const asset = await this.deps.prisma.mediaAsset.findFirst({
        where: { id: result.mediaId },
        select: { width: true, height: true },
      });
      return { mediaId: result.mediaId, publicUrl: result.publicUrl, width: asset?.width ?? null, height: asset?.height ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = classifyImportError(message);
      input.warnings.push(
        warning(input.sourceRecordKey, code, "Place media import failed; the Place commit remains successful.", {
          attachmentId: input.attachmentId,
          error: message,
        }),
      );
      input.counts.failed++;
      return null;
    }
  }
}

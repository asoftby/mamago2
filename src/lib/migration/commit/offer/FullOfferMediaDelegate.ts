import type { PrismaClient } from "@prisma/client";

import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";
import { MediaImportWriter } from "../../media/MediaImportWriter";
import type { MediaImporterLike, MediaLineageWriterLike } from "../../media/types";
import { buildWordPressAttachmentSourceRecordKey } from "../../place-media/attachmentSourceRecordKey";
import type { FullOfferMediaSyncDelegate } from "./OfferMediaSyncer";

export const OFFER_MEDIA_TARGET_ROLE = "offer-media";

export interface OfferMediaAttachmentResolver {
  getAttachmentsByIds(ids: readonly number[]): Promise<Map<number, WordPressAttachmentRow>>;
}

export interface FullOfferMediaDelegatePrismaClient {
  offer: Pick<PrismaClient["offer"], "update">;
  mediaAsset: Pick<PrismaClient["mediaAsset"], "findFirst">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst">;
}

export interface FullOfferMediaDelegateInput {
  offerId: string;
  ownerUserId: string;
  attachmentIds: readonly number[];
  sourceRecordKey: string;
  sourceId?: string;
  sourceHash?: string | null;
  runId?: string | null;
  recordId?: string | null;
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

/**
 * Imports Offer cover + gallery attachments via the shared MediaImportWriter
 * lineage path and writes public URLs onto `Offer.coverImage` /
 * `Offer.galleryImages`. One broken attachment never aborts the rest.
 */
export class FullOfferMediaDelegate implements FullOfferMediaSyncDelegate {
  constructor(
    private readonly deps: {
      prisma: FullOfferMediaDelegatePrismaClient;
      attachmentResolver: OfferMediaAttachmentResolver;
      mediaImporterFactory: (ownerUserId: string) => MediaImporterLike;
      lineageWriter: MediaLineageWriterLike;
    },
  ) {}

  async sync(input: FullOfferMediaDelegateInput): Promise<{ importedCount: number; warnings?: readonly string[] }> {
    const warnings: string[] = [];
    const ids = [...new Set(input.attachmentIds.filter((id) => Number.isInteger(id) && id > 0))];
    if (ids.length === 0) return { importedCount: 0, warnings };

    if (!input.sourceId?.trim()) {
      return { importedCount: 0, warnings: ["OFFER_MEDIA_SOURCE_ID_MISSING: Offer media skipped because sourceId was not provided."] };
    }

    const attachments = await this.deps.attachmentResolver.getAttachmentsByIds(ids);
    const importer = this.deps.mediaImporterFactory(input.ownerUserId);
    const urls: string[] = [];
    let importedCount = 0;

    for (const id of ids) {
      const attachment = attachments.get(id);
      if (!attachment) {
        warnings.push(`OFFER_MEDIA_SOURCE_MISSING:${id}`);
        continue;
      }
      if (isHeicMime(attachment.post_mime_type)) {
        warnings.push(`OFFER_MEDIA_HEIC_UNSUPPORTED:${id}`);
        continue;
      }
      if (!attachment.post_mime_type?.toLowerCase().startsWith("image/")) {
        warnings.push(`OFFER_MEDIA_FORMAT_UNSUPPORTED:${id}`);
        continue;
      }
      if (!isUsableHttpUrl(attachment.guid)) {
        warnings.push(`OFFER_MEDIA_SOURCE_MISSING:${id}`);
        continue;
      }

      const resolved = await this.importOrReuse({
        attachmentId: id,
        attachment,
        importer,
        sourceId: input.sourceId,
        sourceHash: input.sourceHash ?? input.sourceRecordKey,
        runId: input.runId ?? null,
        recordId: input.recordId ?? null,
      });
      if (!resolved) {
        warnings.push(`OFFER_MEDIA_IMPORT_FAILED:${id}`);
        continue;
      }
      importedCount += 1;
      urls.push(resolved.publicUrl);
    }

    const coverImage = urls[0] ?? null;
    const galleryImages = urls.slice(1);
    await this.deps.prisma.offer.update({
      where: { id: input.offerId },
      data: { coverImage, galleryImages },
    });

    if (warnings.length > 0) {
      warnings.push(`OFFER_MEDIA_PARTIAL:imported=${importedCount};failedOrSkipped=${ids.length - importedCount}`);
    }
    return { importedCount, warnings };
  }

  private async importOrReuse(input: {
    attachmentId: number;
    attachment: WordPressAttachmentRow;
    importer: MediaImporterLike;
    sourceId: string;
    sourceHash: string;
    runId: string | null;
    recordId: string | null;
  }): Promise<{ mediaId: string; publicUrl: string } | null> {
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
        select: { id: true, publicUrl: true },
      });
      if (asset?.publicUrl?.trim()) {
        return { mediaId: asset.id, publicUrl: asset.publicUrl.trim() };
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
        targetRole: OFFER_MEDIA_TARGET_ROLE,
        runId: input.runId,
        recordId: input.recordId,
      });
      return { mediaId: result.mediaId, publicUrl: result.publicUrl };
    } catch {
      return null;
    }
  }
}

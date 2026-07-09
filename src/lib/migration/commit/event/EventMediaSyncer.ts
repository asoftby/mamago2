import type { PrismaClient } from "@prisma/client";

import { replaceActivityGalleryFromMediaIds } from "@/lib/business/syncEventGalleryFromMediaIds";
import type { MigrationWarning } from "../../types";
import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";
import { buildWordPressAttachmentSourceRecordKey } from "../../place-media/attachmentSourceRecordKey";
import { MediaImportWriter } from "../../media/MediaImportWriter";
import type { MediaImporterLike, MediaLineageWriterLike } from "../../media/types";
import type { NormalizedEventCandidate } from "./types";

export interface EventMediaAttachmentResolver {
  getAttachmentsByIds(ids: readonly number[]): Promise<Map<number, WordPressAttachmentRow>>;
}

export interface EventMediaSyncerPrismaClient {
  activity: Pick<PrismaClient["activity"], "update">;
  activityImage: Pick<PrismaClient["activityImage"], "create" | "deleteMany" | "findMany">;
  mediaAsset: Pick<PrismaClient["mediaAsset"], "findFirst">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst">;
}

export interface EventMediaSyncInput {
  activityId: string;
  candidate: NormalizedEventCandidate;
  ownerUserId: string | null | undefined;
  sourceId: string;
  sourceHash: string | null;
  runId?: string | null;
  recordId?: string | null;
  sourceRecordKey: string;
}

export interface EventMediaSyncResult {
  warnings: MigrationWarning[];
}

type ImportedEventMedia = {
  mediaId: string;
  publicUrl: string;
};

function warning(
  sourceRecordKey: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  severity: MigrationWarning["severity"] = "WARNING",
): MigrationWarning {
  return { code, message, severity, sourceRecordKey, ...(details ? { details } : {}) };
}

function uniqueAttachmentIds(candidate: NormalizedEventCandidate): number[] {
  const media = candidate.media;
  if (!media) return [];
  return [
    ...(media.featuredAttachmentId !== null ? [media.featuredAttachmentId] : []),
    ...media.galleryAttachmentIds,
  ].filter((id, index, all) => all.indexOf(id) === index);
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

export class EventMediaSyncer {
  constructor(
    private readonly deps: {
      prisma: EventMediaSyncerPrismaClient;
      attachmentResolver: EventMediaAttachmentResolver;
      mediaImporterFactory: (ownerUserId: string) => MediaImporterLike;
      lineageWriter: MediaLineageWriterLike;
    },
  ) {}

  async sync(input: EventMediaSyncInput): Promise<EventMediaSyncResult> {
    const warnings: MigrationWarning[] = [];
    const ids = uniqueAttachmentIds(input.candidate);
    if (ids.length === 0) {
      await this.deps.prisma.activity.update({
        where: { id: input.activityId },
        data: {
          coverImageId: null,
          coverImageUrl: null,
        },
      });
      await replaceActivityGalleryFromMediaIds({
        prisma: this.deps.prisma,
        activityId: input.activityId,
        rawMediaIds: [],
        coverMediaId: null,
      });
      return { warnings };
    }

    const ownerUserId = input.ownerUserId?.trim();
    if (!ownerUserId) {
      warnings.push(
        warning(
          input.sourceRecordKey,
          "EVENT_MEDIA_OWNER_MISSING",
          "Event media was skipped because no ownerUserId was available for migrated MediaAsset ownership.",
          { attachmentIds: ids },
        ),
      );
      return { warnings };
    }

    const attachments = await this.deps.attachmentResolver.getAttachmentsByIds(ids);
    const imported = new Map<number, ImportedEventMedia>();
    const importer = this.deps.mediaImporterFactory(ownerUserId);

    for (const id of ids) {
      const attachment = attachments.get(id);
      if (!attachment) {
        warnings.push(
          warning(input.sourceRecordKey, "EVENT_MEDIA_ATTACHMENT_MISSING", "WordPress attachment row was not found.", {
            attachmentId: id,
          }),
        );
        continue;
      }
      if (!isUsableHttpUrl(attachment.guid)) {
        warnings.push(
          warning(input.sourceRecordKey, "EVENT_MEDIA_URL_INVALID", "WordPress attachment guid is not a valid http(s) URL.", {
            attachmentId: id,
            guid: attachment.guid,
          }),
        );
        continue;
      }

      const importedMedia = await this.importOrReuseAttachment({
        attachmentId: id,
        attachment,
        importer,
        sourceId: input.sourceId,
        sourceHash: input.sourceHash ?? input.sourceRecordKey,
        runId: input.runId ?? null,
        recordId: input.recordId ?? null,
        targetRole: id === input.candidate.media?.featuredAttachmentId ? "cover" : "gallery",
        sourceRecordKey: input.sourceRecordKey,
        warnings,
      });
      if (importedMedia) {
        imported.set(id, importedMedia);
      }
    }

    const featuredId = input.candidate.media?.featuredAttachmentId ?? null;
    const cover = featuredId !== null ? imported.get(featuredId) ?? null : null;
    await this.deps.prisma.activity.update({
      where: { id: input.activityId },
      data: {
        coverImageId: cover?.mediaId ?? null,
        coverImageUrl: cover?.publicUrl ?? null,
      },
    });

    if (cover) {
      warnings.push(
        warning(
          input.sourceRecordKey,
          "EVENT_COVER_IMPORTED",
          "Event cover image was imported and linked.",
          { attachmentId: featuredId, mediaAssetId: cover.mediaId },
          "INFO",
        ),
      );
    }

    const galleryMediaIds = (input.candidate.media?.galleryAttachmentIds ?? [])
      .map((id) => imported.get(id)?.mediaId)
      .filter((id): id is string => Boolean(id));

    await replaceActivityGalleryFromMediaIds({
      prisma: this.deps.prisma,
      activityId: input.activityId,
      rawMediaIds: galleryMediaIds,
      coverMediaId: cover?.mediaId ?? null,
    });

    if (galleryMediaIds.length > 0) {
      warnings.push(
        warning(
          input.sourceRecordKey,
          "EVENT_GALLERY_IMPORTED",
          "Event gallery images were imported and linked.",
          { mediaAssetIds: galleryMediaIds },
          "INFO",
        ),
      );
    }

    return { warnings };
  }

  private async importOrReuseAttachment(input: {
    attachmentId: number;
    attachment: WordPressAttachmentRow;
    importer: MediaImporterLike;
    sourceId: string;
    sourceHash: string;
    runId: string | null;
    recordId: string | null;
    targetRole: string;
    sourceRecordKey: string;
    warnings: MigrationWarning[];
  }): Promise<ImportedEventMedia | null> {
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
        input.warnings.push(
          warning(
            input.sourceRecordKey,
            "EVENT_MEDIA_DEDUP_REUSED",
            "Existing imported MediaAsset lineage was reused for event media.",
            { attachmentId: input.attachmentId, mediaAssetId: asset.id },
            "INFO",
          ),
        );
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
        targetRole: input.targetRole,
        runId: input.runId,
        recordId: input.recordId,
      });
      return { mediaId: result.mediaId, publicUrl: result.publicUrl };
    } catch (error) {
      input.warnings.push(
        warning(
          input.sourceRecordKey,
          "EVENT_MEDIA_DOWNLOAD_FAILED",
          "Event media import failed; the event commit remains successful.",
          {
            attachmentId: input.attachmentId,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
      );
      return null;
    }
  }
}

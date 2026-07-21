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

/**
 * One outcome per requested attachment id — always present, success or
 * failure, never silently dropped. Shared by `sync()` (which converts a
 * failure into a `WARNING` and continues — existing, unchanged commit-path
 * behavior) and any stricter caller (e.g. a standalone media-only replay)
 * that instead needs to treat a failure as fatal before touching anything.
 * Extracted so both call sites share exactly one resolve/import/reuse
 * implementation — never two copies of this logic.
 */
export type AttachmentImportOutcome =
  | ({ ok: true; reused: boolean } & ImportedEventMedia)
  | {
      ok: false;
      code: "EVENT_MEDIA_ATTACHMENT_MISSING" | "EVENT_MEDIA_URL_INVALID" | "EVENT_MEDIA_DOWNLOAD_FAILED";
      message: string;
      details?: Record<string, unknown>;
    };

export interface ResolveAndImportAttachmentsInput {
  ids: readonly number[];
  ownerUserId: string;
  sourceId: string;
  sourceHash: string;
  runId: string | null;
  recordId: string | null;
  featuredAttachmentId: number | null;
}

function warning(
  sourceRecordKey: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  severity: MigrationWarning["severity"] = "WARNING",
): MigrationWarning {
  return { code, message, severity, sourceRecordKey, ...(details ? { details } : {}) };
}

export function uniqueAttachmentIds(candidate: NormalizedEventCandidate): number[] {
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

    const outcomes = await this.resolveAndImportAttachments({
      ids,
      ownerUserId,
      sourceId: input.sourceId,
      sourceHash: input.sourceHash ?? input.sourceRecordKey,
      runId: input.runId ?? null,
      recordId: input.recordId ?? null,
      featuredAttachmentId: input.candidate.media?.featuredAttachmentId ?? null,
    });

    const imported = new Map<number, ImportedEventMedia>();
    for (const [id, outcome] of outcomes) {
      if (outcome.ok) {
        imported.set(id, { mediaId: outcome.mediaId, publicUrl: outcome.publicUrl });
        if (outcome.reused) {
          warnings.push(
            warning(
              input.sourceRecordKey,
              "EVENT_MEDIA_DEDUP_REUSED",
              "Existing imported MediaAsset lineage was reused for event media.",
              { attachmentId: id, mediaAssetId: outcome.mediaId },
              "INFO",
            ),
          );
        }
      } else {
        warnings.push(warning(input.sourceRecordKey, outcome.code, outcome.message, outcome.details));
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

  /**
   * Resolves attachment rows and imports-or-reuses each requested id — the
   * entire attachment-level logic, shared verbatim by `sync()` (which
   * degrades a failure to a `WARNING` and continues) and by a stricter
   * caller that needs to know about a failure *before* touching `Activity`/
   * `ActivityImage` at all. This method itself never writes to `Activity`/
   * `ActivityImage` — only `MediaAsset`/`MigrationLineage(MEDIA_ASSET)` via
   * the existing dedup-or-import path, exactly as before.
   */
  async resolveAndImportAttachments(
    input: ResolveAndImportAttachmentsInput,
  ): Promise<Map<number, AttachmentImportOutcome>> {
    const outcomes = new Map<number, AttachmentImportOutcome>();
    if (input.ids.length === 0) return outcomes;

    const attachments = await this.deps.attachmentResolver.getAttachmentsByIds(input.ids);
    const importer = this.deps.mediaImporterFactory(input.ownerUserId);

    for (const id of input.ids) {
      const attachment = attachments.get(id);
      if (!attachment) {
        outcomes.set(id, {
          ok: false,
          code: "EVENT_MEDIA_ATTACHMENT_MISSING",
          message: "WordPress attachment row was not found.",
          details: { attachmentId: id },
        });
        continue;
      }
      if (!isUsableHttpUrl(attachment.guid)) {
        outcomes.set(id, {
          ok: false,
          code: "EVENT_MEDIA_URL_INVALID",
          message: "WordPress attachment guid is not a valid http(s) URL.",
          details: { attachmentId: id, guid: attachment.guid },
        });
        continue;
      }

      outcomes.set(
        id,
        await this.importOrReuseAttachment({
          attachmentId: id,
          attachment,
          importer,
          sourceId: input.sourceId,
          sourceHash: input.sourceHash,
          runId: input.runId,
          recordId: input.recordId,
          targetRole: id === input.featuredAttachmentId ? "cover" : "gallery",
        }),
      );
    }

    return outcomes;
  }

  /**
   * Read-only existing-lineage lookup, extracted out of
   * `importOrReuseAttachment()`'s own dedup check so a caller can ask "is
   * this attachment already imported?" without risking a download attempt
   * for the ones that aren't — used by `strictEventMediaReplay.ts`'s
   * preflight, which must prove existing target media's origin using only
   * already-committed lineage, never a fresh (and therefore write-causing)
   * import attempt.
   */
  async findExistingMediaAssets(input: { ids: readonly number[]; sourceId: string }): Promise<Map<number, ImportedEventMedia>> {
    const found = new Map<number, ImportedEventMedia>();
    for (const id of input.ids) {
      const existing = await this.findExistingMediaAssetForAttachment(input.sourceId, id);
      if (existing) found.set(id, existing);
    }
    return found;
  }

  private async findExistingMediaAssetForAttachment(sourceId: string, attachmentId: number): Promise<ImportedEventMedia | null> {
    const attachmentSourceRecordKey = buildWordPressAttachmentSourceRecordKey(attachmentId);
    const existingLineage = await this.deps.prisma.migrationLineage.findFirst({
      where: {
        sourceId,
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
    return null;
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
  }): Promise<AttachmentImportOutcome> {
    const existing = await this.findExistingMediaAssetForAttachment(input.sourceId, input.attachmentId);
    if (existing) {
      return { ok: true, reused: true, mediaId: existing.mediaId, publicUrl: existing.publicUrl };
    }

    const attachmentSourceRecordKey = buildWordPressAttachmentSourceRecordKey(input.attachmentId);
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
      return { ok: true, reused: false, mediaId: result.mediaId, publicUrl: result.publicUrl };
    } catch (error) {
      return {
        ok: false,
        code: "EVENT_MEDIA_DOWNLOAD_FAILED",
        message: "Event media import failed; the event commit remains successful.",
        details: {
          attachmentId: input.attachmentId,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

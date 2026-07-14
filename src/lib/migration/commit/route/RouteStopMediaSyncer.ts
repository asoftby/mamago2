import type { PrismaClient } from "@prisma/client";

import type { WordPressAttachmentRow } from "../../adapters/wordpress-db/types";
import { MediaImportWriter } from "../../media/MediaImportWriter";
import type { MediaImporterLike, MediaLineageWriterLike } from "../../media/types";
import { buildWordPressAttachmentSourceRecordKey } from "../../place-media/attachmentSourceRecordKey";
import type { MigrationWarning } from "../../types";
import type { NormalizedRouteCandidate } from "./buildRouteCreateDraft";

export interface RouteStopMediaAttachmentResolver {
  getAttachmentsByIds(ids: readonly number[]): Promise<Map<number, WordPressAttachmentRow>>;
}

export interface RouteStopMediaSyncerPrismaClient {
  routeStop: Pick<PrismaClient["routeStop"], "updateMany">;
  mediaAsset: Pick<PrismaClient["mediaAsset"], "findFirst">;
  migrationLineage: Pick<PrismaClient["migrationLineage"], "findFirst">;
}

export interface RouteStopMediaSyncInput {
  routeId: string;
  candidate: NormalizedRouteCandidate;
  mediaOwnerUserId: string | null | undefined;
  sourceId: string;
  sourceHash: string | null;
  runId?: string | null;
  recordId?: string | null;
  sourceRecordKey: string;
}

export interface RouteStopMediaSyncResult {
  warnings: MigrationWarning[];
}

type ImportedRouteStopMedia = {
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

function uniqueAttachmentIds(candidate: NormalizedRouteCandidate): number[] {
  const ids = candidate.stops.flatMap((stop) => stop.imageAttachmentIds);
  return ids.filter((id, index, all) => all.indexOf(id) === index);
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

/**
 * Imports WordPress route stop attachments through the shared Phoenix media
 * pipeline and links one image per stop through the existing
 * `RouteStop.photoUrl` column. The current Prisma model has no stop gallery
 * relation; extra valid attachment ids are reported as warnings instead of
 * inventing storage.
 */
export class RouteStopMediaSyncer {
  constructor(
    private readonly deps: {
      prisma: RouteStopMediaSyncerPrismaClient;
      attachmentResolver: RouteStopMediaAttachmentResolver;
      mediaImporterFactory: (ownerUserId: string) => MediaImporterLike;
      lineageWriter: MediaLineageWriterLike;
    },
  ) {}

  async sync(input: RouteStopMediaSyncInput): Promise<RouteStopMediaSyncResult> {
    const warnings: MigrationWarning[] = [];
    const ids = uniqueAttachmentIds(input.candidate);
    if (ids.length === 0) {
      return { warnings };
    }

    const ownerUserId = input.mediaOwnerUserId?.trim();
    if (!ownerUserId) {
      warnings.push(
        warning(
          input.sourceRecordKey,
          "ROUTE_STOP_MEDIA_OWNER_MISSING",
          "Route stop media was skipped because no mediaOwnerUserId was available for migrated MediaAsset ownership.",
          { attachmentIds: ids },
        ),
      );
      return { warnings };
    }

    const attachments = await this.deps.attachmentResolver.getAttachmentsByIds(ids);
    const importer = this.deps.mediaImporterFactory(ownerUserId);

    const stopsInCommitOrder = [...input.candidate.stops].sort((a, b) => a.index - b.index);
    for (const [position, stop] of stopsInCommitOrder.entries()) {
      const order = position + 1;
      let primary: { attachmentId: number; media: ImportedRouteStopMedia } | null = null;
      for (const id of stop.imageAttachmentIds) {
        if (primary) break;
        const attachment = attachments.get(id);
        if (!attachment) {
          warnings.push(
            warning(input.sourceRecordKey, "ROUTE_STOP_MEDIA_ATTACHMENT_MISSING", "WordPress attachment row was not found.", {
              attachmentId: id,
              sourceStopIndex: stop.index,
            }),
          );
          continue;
        }
        if (!isUsableHttpUrl(attachment.guid)) {
          warnings.push(
            warning(input.sourceRecordKey, "ROUTE_STOP_MEDIA_URL_INVALID", "WordPress attachment guid is not a valid http(s) URL.", {
              attachmentId: id,
              sourceStopIndex: stop.index,
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
          sourceRecordKey: input.sourceRecordKey,
          warnings,
        });
        if (importedMedia) {
          primary = { attachmentId: id, media: importedMedia };
        }
      }

      await this.deps.prisma.routeStop.updateMany({
        where: { routeId: input.routeId, order },
        data: { photoUrl: primary?.media.publicUrl ?? null },
      });

      if (primary) {
        warnings.push(
          warning(
            input.sourceRecordKey,
            "ROUTE_STOP_MEDIA_IMPORTED",
            "RouteStop photo was imported and linked through RouteStop.photoUrl.",
            {
              sourceStopIndex: stop.index,
              routeStopOrder: order,
              attachmentId: primary.attachmentId,
              mediaAssetId: primary.media.mediaId,
            },
            "INFO",
          ),
        );
      }

      const skippedAfterPrimary =
        primary === null
          ? []
          : stop.imageAttachmentIds.slice(stop.imageAttachmentIds.indexOf(primary.attachmentId) + 1);
      if (skippedAfterPrimary.length > 0) {
        warnings.push(
          warning(
            input.sourceRecordKey,
            "ROUTE_STOP_MEDIA_EXTRA_ATTACHMENTS_SKIPPED",
            "RouteStop has multiple attachments, but current schema stores only one photoUrl; extra attachments were not imported or linked.",
            {
              sourceStopIndex: stop.index,
              routeStopOrder: order,
              linkedAttachmentId: primary?.attachmentId ?? null,
              skippedAttachmentIds: skippedAfterPrimary,
            },
          ),
        );
      }
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
    sourceRecordKey: string;
    warnings: MigrationWarning[];
  }): Promise<ImportedRouteStopMedia | null> {
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
            "ROUTE_STOP_MEDIA_DEDUP_REUSED",
            "Existing imported MediaAsset lineage was reused for route stop media.",
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
        targetRole: "route-stop-photo",
        runId: input.runId,
        recordId: input.recordId,
      });
      return { mediaId: result.mediaId, publicUrl: result.publicUrl };
    } catch (error) {
      input.warnings.push(
        warning(
          input.sourceRecordKey,
          "ROUTE_STOP_MEDIA_DOWNLOAD_FAILED",
          "Route stop media import failed; the Route commit remains successful.",
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

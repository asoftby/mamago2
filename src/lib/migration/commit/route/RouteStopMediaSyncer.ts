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
  route: Pick<PrismaClient["route"], "update">;
  routeStop: Pick<PrismaClient["routeStop"], "updateMany" | "findMany">;
  routeStopImage: Pick<PrismaClient["routeStopImage"], "deleteMany" | "create">;
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

type ImportedRouteMedia = {
  mediaId: string;
  publicUrl: string;
  attachmentId?: number;
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

export function uniquePreserveOrder(ids: readonly number[]): number[] {
  return ids.filter((id, index, all) => all.indexOf(id) === index);
}

export function uniqueAttachmentIds(candidate: NormalizedRouteCandidate): number[] {
  const featuredId = candidate.media.featuredAttachmentId;
  return uniquePreserveOrder([
    ...(featuredId !== null ? [featuredId] : []),
    ...candidate.stops.flatMap((stop) => stop.imageAttachmentIds),
  ]);
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
 * Imports WordPress route media through the shared Phoenix pipeline:
 * - `_thumbnail_id` → existing `Route.coverImageUrl` (URL column, MediaAsset lineage reused)
 * - first usable `images-location-N` id → `RouteStop.photoUrl` (backward compatible)
 * - every usable stop attachment, including the first → `RouteStopImage` in source order
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
    const featuredId = input.candidate.media.featuredAttachmentId;
    const ids = uniqueAttachmentIds(input.candidate);

    if (ids.length === 0) {
      await this.deps.prisma.route.update({
        where: { id: input.routeId },
        data: { coverImageUrl: null },
      });
      await this.replaceStopGalleries({
        routeId: input.routeId,
        stops: input.candidate.stops,
        importedByStopIndex: new Map(),
        warnings,
        sourceRecordKey: input.sourceRecordKey,
      });
      return { warnings };
    }

    const ownerUserId = input.mediaOwnerUserId?.trim();
    if (!ownerUserId) {
      warnings.push(
        warning(
          input.sourceRecordKey,
          "ROUTE_STOP_MEDIA_OWNER_MISSING",
          "Route media was skipped because no mediaOwnerUserId was available for migrated MediaAsset ownership.",
          { attachmentIds: ids, featuredAttachmentId: featuredId },
        ),
      );
      return { warnings };
    }

    const attachments = await this.deps.attachmentResolver.getAttachmentsByIds(ids);
    const importer = this.deps.mediaImporterFactory(ownerUserId);
    const importContext = {
      importer,
      sourceId: input.sourceId,
      sourceHash: input.sourceHash ?? input.sourceRecordKey,
      runId: input.runId ?? null,
      recordId: input.recordId ?? null,
      sourceRecordKey: input.sourceRecordKey,
      warnings,
    };

    const cover = await this.importCover({
      featuredId,
      attachments,
      ...importContext,
    });
    await this.deps.prisma.route.update({
      where: { id: input.routeId },
      data: { coverImageUrl: cover?.publicUrl ?? null },
    });
    if (cover && featuredId !== null) {
      warnings.push(
        warning(
          input.sourceRecordKey,
          "ROUTE_COVER_IMPORTED",
          "Route cover was imported and linked through Route.coverImageUrl.",
          { attachmentId: featuredId, mediaAssetId: cover.mediaId },
          "INFO",
        ),
      );
    }

    const stopsInCommitOrder = [...input.candidate.stops].sort((a, b) => a.index - b.index);
    const importedByStopIndex = new Map<number, ImportedRouteMedia[]>();
    for (const stop of stopsInCommitOrder) {
      const imported: ImportedRouteMedia[] = [];
      const seenMediaIds = new Set<string>();
      for (const id of uniquePreserveOrder(stop.imageAttachmentIds)) {
        const importedMedia = await this.importStopAttachment({
          attachmentId: id,
          sourceStopIndex: stop.index,
          attachments,
          ...importContext,
        });
        if (!importedMedia || seenMediaIds.has(importedMedia.mediaId)) continue;
        seenMediaIds.add(importedMedia.mediaId);
        imported.push({ ...importedMedia, attachmentId: id });
      }
      importedByStopIndex.set(stop.index, imported);
    }

    await this.replaceStopGalleries({
      routeId: input.routeId,
      stops: stopsInCommitOrder,
      importedByStopIndex,
      warnings,
      sourceRecordKey: input.sourceRecordKey,
    });

    return { warnings };
  }

  private async replaceStopGalleries(input: {
    routeId: string;
    stops: NormalizedRouteCandidate["stops"];
    importedByStopIndex: Map<number, ImportedRouteMedia[]>;
    warnings: MigrationWarning[];
    sourceRecordKey: string;
  }): Promise<void> {
    const stopRows = await this.deps.prisma.routeStop.findMany({
      where: { routeId: input.routeId },
      select: { id: true, order: true },
    });
    const idByOrder = new Map(stopRows.map((row) => [row.order, row.id]));
    const stopsInCommitOrder = [...input.stops].sort((a, b) => a.index - b.index);

    for (const [position, stop] of stopsInCommitOrder.entries()) {
      const order = position + 1;
      const imported = input.importedByStopIndex.get(stop.index) ?? [];
      const primary = imported[0] ?? null;

      await this.deps.prisma.routeStop.updateMany({
        where: { routeId: input.routeId, order },
        data: { photoUrl: primary?.publicUrl ?? null },
      });

      const routeStopId = idByOrder.get(order);
      if (!routeStopId) {
        input.warnings.push(
          warning(
            input.sourceRecordKey,
            "ROUTE_STOP_MEDIA_TARGET_MISSING",
            "RouteStop row was not found for gallery replace; stop media was not linked.",
            { sourceStopIndex: stop.index, routeStopOrder: order },
          ),
        );
        continue;
      }

      await this.deps.prisma.routeStopImage.deleteMany({ where: { routeStopId } });
      for (const [sortOrder, media] of imported.entries()) {
        await this.deps.prisma.routeStopImage.create({
          data: {
            routeStopId,
            mediaAssetId: media.mediaId,
            url: media.publicUrl,
            sortOrder,
          },
        });
      }

      if (primary) {
        input.warnings.push(
          warning(
            input.sourceRecordKey,
            "ROUTE_STOP_MEDIA_IMPORTED",
            "RouteStop photo was imported and linked through RouteStop.photoUrl.",
            {
              sourceStopIndex: stop.index,
              routeStopOrder: order,
              attachmentId: primary.attachmentId ?? null,
              mediaAssetId: primary.mediaId,
              galleryCount: imported.length,
            },
            "INFO",
          ),
        );
      }
    }
  }

  private async importCover(input: {
    featuredId: number | null;
    attachments: Map<number, WordPressAttachmentRow>;
    importer: MediaImporterLike;
    sourceId: string;
    sourceHash: string;
    runId: string | null;
    recordId: string | null;
    sourceRecordKey: string;
    warnings: MigrationWarning[];
  }): Promise<ImportedRouteMedia | null> {
    if (input.featuredId === null) return null;
    return this.resolveAndImportAttachment({
      attachmentId: input.featuredId,
      attachments: input.attachments,
      missingCode: "ROUTE_COVER_ATTACHMENT_MISSING",
      invalidUrlCode: "ROUTE_COVER_URL_INVALID",
      downloadFailedCode: "ROUTE_COVER_DOWNLOAD_FAILED",
      downloadFailedMessage: "Route cover import failed; the Route commit remains successful.",
      targetRole: "route-cover",
      importer: input.importer,
      sourceId: input.sourceId,
      sourceHash: input.sourceHash,
      runId: input.runId,
      recordId: input.recordId,
      sourceRecordKey: input.sourceRecordKey,
      warnings: input.warnings,
    });
  }

  private async importStopAttachment(input: {
    attachmentId: number;
    sourceStopIndex: number;
    attachments: Map<number, WordPressAttachmentRow>;
    importer: MediaImporterLike;
    sourceId: string;
    sourceHash: string;
    runId: string | null;
    recordId: string | null;
    sourceRecordKey: string;
    warnings: MigrationWarning[];
  }): Promise<ImportedRouteMedia | null> {
    return this.resolveAndImportAttachment({
      attachmentId: input.attachmentId,
      attachments: input.attachments,
      missingCode: "ROUTE_STOP_MEDIA_ATTACHMENT_MISSING",
      invalidUrlCode: "ROUTE_STOP_MEDIA_URL_INVALID",
      downloadFailedCode: "ROUTE_STOP_MEDIA_DOWNLOAD_FAILED",
      downloadFailedMessage: "Route stop media import failed; the Route commit remains successful.",
      targetRole: "route-stop-photo",
      details: { sourceStopIndex: input.sourceStopIndex },
      importer: input.importer,
      sourceId: input.sourceId,
      sourceHash: input.sourceHash,
      runId: input.runId,
      recordId: input.recordId,
      sourceRecordKey: input.sourceRecordKey,
      warnings: input.warnings,
    });
  }

  private async resolveAndImportAttachment(input: {
    attachmentId: number;
    attachments: Map<number, WordPressAttachmentRow>;
    missingCode: string;
    invalidUrlCode: string;
    downloadFailedCode: string;
    downloadFailedMessage: string;
    targetRole: string;
    details?: Record<string, unknown>;
    importer: MediaImporterLike;
    sourceId: string;
    sourceHash: string;
    runId: string | null;
    recordId: string | null;
    sourceRecordKey: string;
    warnings: MigrationWarning[];
  }): Promise<ImportedRouteMedia | null> {
    const attachment = input.attachments.get(input.attachmentId);
    if (!attachment) {
      input.warnings.push(
        warning(input.sourceRecordKey, input.missingCode, "WordPress attachment row was not found.", {
          attachmentId: input.attachmentId,
          ...input.details,
        }),
      );
      return null;
    }
    if (!isUsableHttpUrl(attachment.guid)) {
      input.warnings.push(
        warning(
          input.sourceRecordKey,
          input.invalidUrlCode,
          "WordPress attachment guid is not a valid http(s) URL.",
          {
            attachmentId: input.attachmentId,
            guid: attachment.guid,
            ...input.details,
          },
        ),
      );
      return null;
    }
    return this.importOrReuseAttachment({
      attachmentId: input.attachmentId,
      attachment,
      importer: input.importer,
      sourceId: input.sourceId,
      sourceHash: input.sourceHash,
      runId: input.runId,
      recordId: input.recordId,
      sourceRecordKey: input.sourceRecordKey,
      targetRole: input.targetRole,
      downloadFailedCode: input.downloadFailedCode,
      downloadFailedMessage: input.downloadFailedMessage,
      warnings: input.warnings,
    });
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
    targetRole: string;
    downloadFailedCode: string;
    downloadFailedMessage: string;
    warnings: MigrationWarning[];
  }): Promise<ImportedRouteMedia | null> {
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
            "Existing imported MediaAsset lineage was reused for route media.",
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
        warning(input.sourceRecordKey, input.downloadFailedCode, input.downloadFailedMessage, {
          attachmentId: input.attachmentId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return null;
    }
  }
}

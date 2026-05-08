/**
 * Media Service
 * 
 * Core service for media asset management.
 * Handles CRUD operations, status transitions, and safe deletion.
 */

import { existsSync } from "fs";
import { unlink } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { MediaAssetKind, MediaAssetStatus, MediaSourceType } from "@prisma/client";
import {
  resolveLegacyPublicUploadPath,
  resolveStoredMediaPath,
} from "@/server/media/media-storage";

export interface CreateMediaAssetInput {
  kind: MediaAssetKind;
  filename: string;
  originalName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  storageKey: string;
  publicUrl?: string;
  checksum?: string;
  alt?: string;
  title?: string;
  caption?: string;
  sourceType: MediaSourceType;
  uploadedById?: string;
  // TEMP media fields
  status?: "TEMP" | "ACTIVE";
  wizardSessionId?: string;
  draftEntityId?: string;
  draftEntityType?: string;
}

export interface UpdateMediaMetadataInput {
  alt?: string;
  title?: string;
  caption?: string;
}

/**
 * Create new media asset
 */
export async function createMediaAsset(input: CreateMediaAssetInput) {
  return prisma.mediaAsset.create({
    data: {
      kind: input.kind,
      status: input.status === "TEMP" ? MediaAssetStatus.TEMP : MediaAssetStatus.ACTIVE,
      filename: input.filename,
      originalName: input.originalName,
      mimeType: input.mimeType,
      extension: input.extension,
      sizeBytes: input.sizeBytes,
      width: input.width,
      height: input.height,
      durationSec: input.durationSec,
      storageKey: input.storageKey,
      publicUrl: input.publicUrl,
      checksum: input.checksum,
      alt: input.alt,
      title: input.title,
      caption: input.caption,
      sourceType: input.sourceType,
      uploadedById: input.uploadedById,
      wizardSessionId: input.wizardSessionId,
      draftEntityId: input.draftEntityId,
      draftEntityType: input.draftEntityType,
    },
  });
}

/**
 * Get media asset by ID
 */
export async function getMediaAssetById(id: string) {
  return prisma.mediaAsset.findUnique({
    where: { id },
    include: {
      uploadedBy: {
        select: {
          id: true,
          email: true,
        },
      },
      usages: {
        include: {
          media: false,
        },
      },
    },
  });
}

/**
 * Get media asset by storage key
 */
export async function getMediaAssetByStorageKey(storageKey: string) {
  return prisma.mediaAsset.findUnique({
    where: { storageKey },
  });
}

/**
 * Update media metadata
 */
export async function updateMediaMetadata(id: string, input: UpdateMediaMetadataInput) {
  return prisma.mediaAsset.update({
    where: { id },
    data: {
      ...(input.alt !== undefined && { alt: input.alt }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.caption !== undefined && { caption: input.caption }),
    },
  });
}

/**
 * Archive media asset
 */
export async function archiveMediaAsset(id: string) {
  return prisma.mediaAsset.update({
    where: { id },
    data: {
      status: MediaAssetStatus.ARCHIVED,
    },
  });
}

/**
 * Soft delete media asset
 * Only allowed if no active usages
 */
export async function softDeleteMediaAsset(id: string, force = false) {
  const usageCount = await prisma.mediaUsage.count({
    where: { mediaId: id },
  });

  if (usageCount > 0 && !force) {
    throw new Error(
      `Cannot delete media asset with ${usageCount} active usage(s). Use force=true to override.`
    );
  }

  return prisma.mediaAsset.update({
    where: { id },
    data: {
      status: MediaAssetStatus.DELETED,
      deletedAt: new Date(),
    },
  });
}

export type HardDeleteMediaResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "in_use" };

/**
 * Удаляет файл с диска и запись в БД. Только если нет привязок (usages).
 * Соответствует DELETE /api/admin/media/[id].
 */
export async function hardDeleteMediaAssetIfUnused(id: string): Promise<HardDeleteMediaResult> {
  const media = await prisma.mediaAsset.findUnique({
    where: { id },
    include: {
      usages: { select: { id: true } },
    },
  });

  if (!media) {
    return { ok: false, reason: "not_found" };
  }

  if (media.usages.length > 0) {
    return { ok: false, reason: "in_use" };
  }

  if (media.publicUrl) {
    const filePath =
      resolveStoredMediaPath(media.publicUrl) ??
      resolveStoredMediaPath(media.storageKey) ??
      resolveLegacyPublicUploadPath(media.publicUrl) ??
      resolveLegacyPublicUploadPath(media.storageKey);
    if (filePath && existsSync(filePath)) {
      try {
        await unlink(filePath);
      } catch (err) {
        console.error("Failed to delete file:", err);
      }
    }
  }

  await prisma.mediaAsset.delete({
    where: { id },
  });

  return { ok: true };
}

export interface BulkHardDeleteUnusedResult {
  deleted: number;
  skippedInUse: number;
  skippedNotFound: number;
}

/** Массовое удаление: по каждому id — только если usages пусты. */
export async function bulkHardDeleteUnusedMediaAssets(
  ids: string[],
  options?: { maxBatch?: number }
): Promise<BulkHardDeleteUnusedResult> {
  const maxBatch = options?.maxBatch ?? 200;
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const slice = unique.slice(0, maxBatch);

  let deleted = 0;
  let skippedInUse = 0;
  let skippedNotFound = 0;

  for (const id of slice) {
    const r = await hardDeleteMediaAssetIfUnused(id);
    if (r.ok) deleted++;
    else if (r.reason === "in_use") skippedInUse++;
    else skippedNotFound++;
  }

  return { deleted, skippedInUse, skippedNotFound };
}

/**
 * Restore media asset
 */
export async function restoreMediaAsset(id: string) {
  const media = await prisma.mediaAsset.findUnique({
    where: { id },
    include: {
      usages: true,
    },
  });

  if (!media) {
    throw new Error("Media asset not found");
  }

  const newStatus = media.usages.length > 0 
    ? MediaAssetStatus.ACTIVE 
    : MediaAssetStatus.ORPHANED;

  return prisma.mediaAsset.update({
    where: { id },
    data: {
      status: newStatus,
      deletedAt: null,
    },
  });
}

/**
 * Block media asset (moderation)
 */
export async function blockMediaAsset(id: string) {
  return prisma.mediaAsset.update({
    where: { id },
    data: {
      status: MediaAssetStatus.BLOCKED,
    },
  });
}

/**
 * Recalculate orphaned status for single media
 */
export async function recalculateMediaUsageStatus(id: string) {
  const usageCount = await prisma.mediaUsage.count({
    where: { mediaId: id },
  });

  const media = await prisma.mediaAsset.findUnique({
    where: { id },
  });

  if (!media) {
    throw new Error("Media asset not found");
  }

  // Don't change status if archived, deleted, or blocked
  if (["ARCHIVED", "DELETED", "BLOCKED"].includes(media.status)) {
    return media;
  }

  const newStatus = usageCount > 0 
    ? MediaAssetStatus.ACTIVE 
    : MediaAssetStatus.ORPHANED;

  return prisma.mediaAsset.update({
    where: { id },
    data: {
      status: newStatus,
    },
  });
}

/**
 * Recalculate orphaned status for all media
 */
export async function recalculateAllOrphanedStatuses() {
  // Get all active/orphaned media
  const mediaAssets = await prisma.mediaAsset.findMany({
    where: {
      status: {
        in: [MediaAssetStatus.ACTIVE, MediaAssetStatus.ORPHANED],
      },
    },
    select: {
      id: true,
    },
  });

  let updated = 0;

  for (const media of mediaAssets) {
    await recalculateMediaUsageStatus(media.id);
    updated++;
  }

  return { updated };
}

/**
 * Get media stats
 */
export async function getMediaStats() {
  const [
    total,
    temp,
    active,
    orphaned,
    archived,
    deleted,
    blocked,
    byKind,
    bySource,
  ] = await Promise.all([
    prisma.mediaAsset.count(),
    prisma.mediaAsset.count({ where: { status: MediaAssetStatus.TEMP } }),
    prisma.mediaAsset.count({ where: { status: MediaAssetStatus.ACTIVE } }),
    prisma.mediaAsset.count({ where: { status: MediaAssetStatus.ORPHANED } }),
    prisma.mediaAsset.count({ where: { status: MediaAssetStatus.ARCHIVED } }),
    prisma.mediaAsset.count({ where: { status: MediaAssetStatus.DELETED } }),
    prisma.mediaAsset.count({ where: { status: MediaAssetStatus.BLOCKED } }),
    prisma.mediaAsset.groupBy({
      by: ["kind"],
      _count: true,
    }),
    prisma.mediaAsset.groupBy({
      by: ["sourceType"],
      _count: true,
    }),
  ]);

  return {
    total,
    byStatus: {
      temp,
      active,
      orphaned,
      archived,
      deleted,
      blocked,
    },
    byKind: byKind.reduce((acc, item) => {
      acc[item.kind] = item._count;
      return acc;
    }, {} as Record<string, number>),
    bySource: bySource.reduce((acc, item) => {
      acc[item.sourceType] = item._count;
      return acc;
    }, {} as Record<string, number>),
  };
}

/**
 * Commit TEMP media assets to ACTIVE status
 * Called when wizard entity (Activity/Place) is published
 */
export async function commitTempMediaToActive(params: {
  wizardSessionId?: string;
  draftEntityId?: string;
  draftEntityType?: string;
}) {
  const where: {
    status: MediaAssetStatus;
    wizardSessionId?: string;
    draftEntityId?: string;
    draftEntityType?: string;
  } = {
    status: MediaAssetStatus.TEMP,
  };

  if (params.wizardSessionId) {
    where.wizardSessionId = params.wizardSessionId;
  }
  if (params.draftEntityId) {
    where.draftEntityId = params.draftEntityId;
  }
  if (params.draftEntityType) {
    where.draftEntityType = params.draftEntityType;
  }

  const result = await prisma.mediaAsset.updateMany({
    where,
    data: {
      status: MediaAssetStatus.ACTIVE,
      // Clear wizard session fields after commit
      wizardSessionId: null,
      draftEntityId: null,
      draftEntityType: null,
    },
  });

  console.log(`✅ [MEDIA] Committed ${result.count} TEMP media assets to ACTIVE`, params);

  return result;
}

/**
 * Clean up abandoned TEMP media assets
 * Should be called by a cron job
 */
export async function cleanupAbandonedTempMedia(olderThanHours = 24) {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

  const tempMedia = await prisma.mediaAsset.findMany({
    where: {
      status: MediaAssetStatus.TEMP,
      createdAt: {
        lt: cutoffDate,
      },
    },
    select: {
      id: true,
      storageKey: true,
      publicUrl: true,
      createdAt: true,
    },
  });

  console.log(`🧹 [MEDIA] Found ${tempMedia.length} abandoned TEMP media assets older than ${olderThanHours}h`);

  let deleted = 0;
  for (const media of tempMedia) {
    try {
      // Delete file from storage
      if (media.publicUrl) {
        const filePath =
          resolveStoredMediaPath(media.publicUrl) ??
          resolveStoredMediaPath(media.storageKey) ??
          resolveLegacyPublicUploadPath(media.publicUrl) ??
          resolveLegacyPublicUploadPath(media.storageKey);
        if (filePath && existsSync(filePath)) {
          await unlink(filePath);
        }
      }

      // Delete from database
      await prisma.mediaAsset.delete({
        where: { id: media.id },
      });

      deleted++;
    } catch (error) {
      console.error(`❌ [MEDIA] Failed to delete TEMP media ${media.id}:`, error);
    }
  }

  console.log(`✅ [MEDIA] Cleaned up ${deleted} abandoned TEMP media assets`);

  return { found: tempMedia.length, deleted };
}

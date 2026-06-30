import "server-only";

import { stat } from "fs/promises";
import { basename } from "path";
import type { Role } from "@prisma/client";
import { MediaSourceType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
import {
  extractMediaRelativePathFromUrl,
  mimeTypeFromFilename,
  resolveStoredMediaPath,
} from "@/server/media/media-storage";

function mediaSourceTypeForRole(role: Role): MediaSourceType {
  if (role === "ADMIN" || role === "MODERATOR") return MediaSourceType.ADMIN_UPLOAD;
  if (role === "BUSINESS_OWNER") return MediaSourceType.BUSINESS_UPLOAD;
  return MediaSourceType.USER_UPLOAD;
}

/**
 * Ensure a MediaAsset row exists for a file already stored under storage/uploads
 * and served via /api/media/file/... — used when a flow wrote bytes via
 * writeRuntimeUpload but skipped registerUploadedMedia (e.g. Instagram import).
 */
export async function ensureMediaAssetForStoredFileUrl(params: {
  publicUrl: string;
  uploadedById: string;
  userRole: Role;
  width?: number | null;
  height?: number | null;
  originalName?: string;
  /** SHA-256 of raw original bytes — stored for future dedup. */
  contentHash?: string;
}) {
  const trimmed = params.publicUrl?.trim();
  if (!trimmed || !extractMediaRelativePathFromUrl(trimmed)) {
    return null;
  }

  const existing = await prisma.mediaAsset.findFirst({
    where: { OR: [{ storageKey: trimmed }, { publicUrl: trimmed }] },
  });
  if (existing) {
    return existing;
  }

  const abs = resolveStoredMediaPath(trimmed);
  if (!abs) {
    return null;
  }

  let sizeBytes: number;
  try {
    sizeBytes = (await stat(abs)).size;
  } catch {
    return null;
  }

  const rel = extractMediaRelativePathFromUrl(trimmed);
  const filename = rel ? basename(rel) : basename(abs);

  return registerUploadedMedia({
    filename,
    originalName: params.originalName ?? filename,
    mimeType: mimeTypeFromFilename(filename),
    sizeBytes,
    width: params.width ?? undefined,
    height: params.height ?? undefined,
    storageKey: trimmed,
    publicUrl: trimmed,
    sourceType: mediaSourceTypeForRole(params.userRole),
    uploadedById: params.uploadedById,
    contentHash: params.contentHash,
  });
}

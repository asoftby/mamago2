/**
 * Media dedup helpers (Phase A — forward-prevention).
 *
 * The dedup key is the SHA-256 of the RAW original bytes of an upload, computed
 * BEFORE any sharp processing. Hashing the raw original (not the sanitized
 * output) keeps the key stable across libvips/sharp versions — re-encoding the
 * same source on a different sharp build would otherwise produce a different
 * hash and defeat dedup.
 *
 * Sanitization (sharp re-encode, EXIF drop, decompression-bomb pixel cap) is a
 * separate, storage-side concern — see `imageProcessor` / `imported-image-optimizer`.
 *
 * The key is PER-OWNER (`uploadedById`), never global: UGC produces thousands of
 * owners, and globally sharing one MediaAsset across users would break ownership
 * and deletion semantics.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { MediaAsset } from "@prisma/client";

/** SHA-256 of the raw original bytes, hex-encoded. */
export function contentHashOf(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Look up an existing owned asset with the same content hash.
 *
 * Returns null when there is no owner: the dedup key is per-owner, and without
 * an owner we cannot safely reuse another user's asset. This also mirrors the
 * planned partial unique index `(uploadedById, contentHash) WHERE contentHash IS
 * NOT NULL`, under which NULL owners do not collide.
 */
export async function findOwnedMediaByContentHash(
  uploadedById: string | null | undefined,
  contentHash: string,
): Promise<MediaAsset | null> {
  if (!uploadedById) return null;
  return prisma.mediaAsset.findFirst({
    where: { uploadedById, contentHash },
  });
}

/**
 * Look up a duplicate for system/import/fetch paths (downloaded bytes).
 *
 * - With an owner → per-owner match `{ uploadedById, contentHash }`, same key as
 *   user uploads.
 * - Without an owner (system-generated) → GLOBAL match `{ contentHash }`. A
 *   system asset has no owner, so collapsing against any same-bytes asset is the
 *   correct behavior here.
 *
 * Note the asymmetry across the owner boundary: an owner'd path will NOT match a
 * system (null-owner) asset, while the system path matches globally. So the same
 * image arriving via both a system path and an owner'd path will not collapse
 * into one row in the owner'd direction — see report.
 */
export async function findDuplicateMediaByContentHash(
  uploadedById: string | null | undefined,
  contentHash: string,
): Promise<MediaAsset | null> {
  return prisma.mediaAsset.findFirst({
    where: uploadedById ? { uploadedById, contentHash } : { contentHash },
  });
}

/**
 * Build the upload-route JSON payload from an already-existing asset (dedup hit).
 *
 * No new file is written and no responsive sizes are regenerated, so
 * `responsiveSizes` is empty — the stored master URL is what references rely on.
 * Wizard routes spread this and add their own `status` / `wizardSessionId`.
 */
export function buildDedupUploadResponse(asset: MediaAsset) {
  const url = asset.publicUrl ?? asset.storageKey;
  const status = asset.status === "TEMP" ? "TEMP" : "PERSISTENT";

  return {
    media: {
      id: asset.id,
      url,
      mimeType: asset.mimeType,
      fileName: asset.filename,
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
      size: asset.sizeBytes,
      status,
    },
    id: asset.id,
    mediaId: asset.id,
    url,
    publicUrl: url,
    mimeType: asset.mimeType,
    fileName: asset.filename,
    filename: asset.filename,
    size: asset.sizeBytes,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    format: asset.extension,
    originalFormat: asset.mimeType,
    responsiveSizes: {} as Record<string, string>,
    processed: true,
    deduplicated: true,
  };
}

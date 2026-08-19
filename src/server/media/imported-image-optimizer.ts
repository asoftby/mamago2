/**
 * Imported Image Optimizer
 *
 * Downloads an external image URL, converts to WebP, saves to local storage,
 * and creates a MediaAsset record. Used in the import publish pipeline.
 *
 * Output: WebP, max 1600×1600, quality 80, no upscaling.
 */

import { createHash } from "crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { MediaAssetKind, MediaAssetStatus, MediaSourceType } from "@prisma/client";
import { writeRuntimeUpload } from "@/server/media/media-storage";
import { assertSafeRemoteUrl } from "@/lib/security/assertSafeRemoteUrl";
import { contentHashOf, findOwnedMediaByContentHash } from "@/lib/media/dedup";

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_SOURCE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const OUTPUT_MAX_DIMENSION = 1600;
const OUTPUT_QUALITY = 80;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OptimizedImageResult {
  mediaAssetId: string;
  publicUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalUrl: string;
}

export interface OptimizeImageError {
  error: string;
  originalUrl: string;
}

export type OptimizeImageOutcome =
  | ({ ok: true } & OptimizedImageResult)
  | ({ ok: false } & OptimizeImageError);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urlHash(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 12);
}

function buildFilename(recordId: string, url: string): string {
  return `imported-${recordId}-${urlHash(url)}.webp`;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Download, optimize, and store an image from an external URL.
 *
 * - Idempotent: if a MediaAsset with the same storageKey already exists, returns it.
 * - Does NOT throw — returns { ok: false, error } on any failure.
 *
 * `uploadedById` is the acting user (import is always triggered by an admin) —
 * the created asset is owned, never null, and dedup is per-owner.
 */
export async function optimizeImportedImage(
  originalUrl: string,
  importedRecordId: string,
  uploadedById: string,
): Promise<OptimizeImageOutcome> {
  if (!originalUrl?.trim()) {
    return { ok: false, error: "Empty URL", originalUrl };
  }

  // SSRF protection: validate URL before fetching
  try {
    assertSafeRemoteUrl(originalUrl);
  } catch {
    return { ok: false, error: "Unsafe remote URL", originalUrl };
  }

  const filename = buildFilename(importedRecordId, originalUrl);
  const upload = {
    filename,
    publicUrl: "",
  };

  // ── Idempotency: already processed ────────────────────────────────────────
  const existing = await prisma.mediaAsset.findFirst({
    where: { filename },
    select: { id: true, publicUrl: true, width: true, height: true, sizeBytes: true },
  });

  if (existing?.publicUrl) {
    return {
      ok: true,
      mediaAssetId: existing.id,
      publicUrl: existing.publicUrl,
      width: existing.width ?? 0,
      height: existing.height ?? 0,
      sizeBytes: existing.sizeBytes,
      originalUrl,
    };
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    response = await fetch(originalUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "mamaGo-importer/1.0" },
    });
    clearTimeout(timeout);
  } catch (err) {
    return {
      ok: false,
      error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      originalUrl,
    };
  }

  if (!response.ok) {
    return { ok: false, error: `HTTP ${response.status}`, originalUrl };
  }

  // ── Validate content-type ──────────────────────────────────────────────────
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return {
      ok: false,
      error: `Unsupported content-type: ${contentType || "unknown"}`,
      originalUrl,
    };
  }

  // ── Validate size ──────────────────────────────────────────────────────────
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SOURCE_BYTES) {
    return {
      ok: false,
      error: `Source too large: ${contentLength} bytes (max ${MAX_SOURCE_BYTES})`,
      originalUrl,
    };
  }

  let buffer: Buffer;
  try {
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength > MAX_SOURCE_BYTES) {
      return {
        ok: false,
        error: `Downloaded size too large: ${buffer.byteLength} bytes`,
        originalUrl,
      };
    }
  } catch (err) {
    return {
      ok: false,
      error: `Read body failed: ${err instanceof Error ? err.message : String(err)}`,
      originalUrl,
    };
  }

  // ── Dedup raw downloaded bytes before sharp/write ──────────────────────────
  // Per-owner dedup (acting admin owns the imported asset).
  const contentHash = contentHashOf(buffer);
  const duplicate = await findOwnedMediaByContentHash(uploadedById, contentHash);
  if (duplicate?.publicUrl) {
    console.log(
      `[import-image-optimizer] ♻️  Dedup hit ${duplicate.id} — reusing, no new file`,
    );
    return {
      ok: true,
      mediaAssetId: duplicate.id,
      publicUrl: duplicate.publicUrl,
      width: duplicate.width ?? 0,
      height: duplicate.height ?? 0,
      sizeBytes: duplicate.sizeBytes,
      originalUrl,
    };
  }

  // ── Process with sharp ─────────────────────────────────────────────────────
  let webpBuffer: Buffer;
  let width: number;
  let height: number;

  try {
    const pipeline = sharp(buffer)
      .rotate() // auto-orient from EXIF
      .resize({
        width: OUTPUT_MAX_DIMENSION,
        height: OUTPUT_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: OUTPUT_QUALITY });

    const result = await pipeline.toBuffer({ resolveWithObject: true });
    webpBuffer = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch (err) {
    return {
      ok: false,
      error: `Sharp processing failed: ${err instanceof Error ? err.message : String(err)}`,
      originalUrl,
    };
  }

  // ── Save to disk ───────────────────────────────────────────────────────────
  try {
    const saved = await writeRuntimeUpload(filename, webpBuffer);
    upload.filename = saved.filename;
    upload.publicUrl = saved.publicUrl;
  } catch (err) {
    return {
      ok: false,
      error: `File write failed: ${err instanceof Error ? err.message : String(err)}`,
      originalUrl,
    };
  }

  // ── Create MediaAsset record ───────────────────────────────────────────────
  const mediaAsset = await prisma.mediaAsset.create({
    data: {
      kind: MediaAssetKind.IMAGE,
      status: MediaAssetStatus.ACTIVE,
      filename,
      originalName: filename,
      mimeType: "image/webp",
      extension: "webp",
      sizeBytes: webpBuffer.byteLength,
      width,
      height,
      storageKey: upload.publicUrl,
      publicUrl: upload.publicUrl,
      // Content hash of the raw downloaded original (before sharp).
      contentHash,
      // Owned by the acting admin — never null (per-owner dedup invariant).
      uploadedById,
      sourceType: MediaSourceType.SYSTEM_GENERATED,
      alt: null,
      title: null,
    },
  });

  console.log(
    `[import-image-optimizer] ✅ ${filename} ${width}×${height} ${Math.round(webpBuffer.byteLength / 1024)}KB (from ${Math.round(buffer.byteLength / 1024)}KB)`,
  );

  return {
    ok: true,
    mediaAssetId: mediaAsset.id,
    publicUrl: upload.publicUrl,
    width,
    height,
    sizeBytes: webpBuffer.byteLength,
    originalUrl,
  };
}

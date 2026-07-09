import { MediaSourceType } from "@prisma/client";

import {
  DEFAULT_IMAGE_CONFIG,
  generateProcessedFilename,
  processImage,
} from "@/lib/media/imageProcessor";
import { registerUploadedMedia } from "@/lib/media/mediaRegistry";
import { writeRuntimeUpload } from "@/server/media/media-storage";

import type { ImportedMediaResult, ImportMediaFromUrlInput, MediaImporterLike } from "./types";

const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;

function mimeFromContentType(header: string | null): string {
  if (!header) {
    return "application/octet-stream";
  }
  const base = header.split(";")[0]?.trim().toLowerCase() ?? "";
  return base || "application/octet-stream";
}

function sniffImageMime(buf: Buffer, contentTypeMime: string): string {
  if (contentTypeMime.startsWith("image/")) {
    return contentTypeMime;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return "image/jpeg";
  }
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return "image/png";
  }
  if (buf[0] === 0x52 && buf[1] === 0x49) {
    return "image/webp";
  }
  return contentTypeMime;
}

export interface CreateMamagoMediaImporterDeps {
  /**
   * The mamaGo user account migrated media is attributed to. Every
   * `MediaAsset` must be owned (per-owner dedup invariant in
   * `registerUploadedMedia`) — this is supplied by the caller, never
   * invented here.
   */
  uploadedByUserId: string;
}

/**
 * Concrete `MediaImporterLike` wired to mamaGo's existing upload
 * pipeline — the same download -> `processImage` -> `writeRuntimeUpload`
 * -> `registerUploadedMedia` chain already used in production by
 * `POST /api/media/from-url`. This file has no behavioral unit tests: it
 * would require mocking the network and filesystem, which buys nothing
 * over testing `MediaImportWriter` itself against a fake
 * `MediaImporterLike`. Only `tsc`/lint cover this file's correctness.
 */
export function createMamagoMediaImporter(deps: CreateMamagoMediaImporterDeps): MediaImporterLike {
  return {
    async importFromUrl(input: ImportMediaFromUrlInput): Promise<ImportedMediaResult> {
      const url = new URL(input.sourceUrl);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let remote: Response;
      try {
        remote = await fetch(url.toString(), {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            Accept: "image/*,*/*;q=0.8",
            "User-Agent": "MamaGoMediaImporter/1.0",
          },
        });
      } finally {
        clearTimeout(timer);
      }

      if (!remote.ok) {
        throw new Error(`Failed to download media from ${url.toString()}: HTTP ${remote.status}`);
      }

      const buf = Buffer.from(await remote.arrayBuffer());
      if (buf.length > MAX_BYTES) {
        throw new Error(`Media at ${url.toString()} exceeds the maximum allowed size.`);
      }

      const mime = sniffImageMime(buf, mimeFromContentType(remote.headers.get("content-type")));
      if (!mime.startsWith("image/")) {
        throw new Error(`Media at ${url.toString()} is not an image (${mime}).`);
      }

      const processedImageSet = await processImage(buf, mime, DEFAULT_IMAGE_CONFIG);

      const baseName = input.filenameHint || url.pathname.split("/").pop() || "import";
      const masterFilename = generateProcessedFilename(`${baseName}.jpg`);
      const masterSaved = await writeRuntimeUpload(masterFilename, processedImageSet.master.buffer);

      for (const [sizeName, sizeData] of Object.entries(processedImageSet.sizes)) {
        if (sizeData) {
          await writeRuntimeUpload(generateProcessedFilename(`${baseName}.jpg`, sizeName), sizeData.buffer);
        }
      }

      const asset = await registerUploadedMedia({
        filename: masterSaved.filename,
        originalName: url.pathname.split("/").pop() || "import.jpg",
        mimeType: "image/webp",
        sizeBytes: processedImageSet.master.size,
        width: processedImageSet.master.width,
        height: processedImageSet.master.height,
        storageKey: masterSaved.publicUrl,
        publicUrl: masterSaved.publicUrl,
        sourceType: MediaSourceType.MIGRATED,
        uploadedById: deps.uploadedByUserId,
        title: input.title ?? undefined,
      });

      return {
        mediaId: asset.id,
        storageKey: asset.storageKey,
        publicUrl: asset.publicUrl ?? masterSaved.publicUrl,
        width: asset.width ?? null,
        height: asset.height ?? null,
      };
    },
  };
}

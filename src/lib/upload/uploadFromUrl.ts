/**
 * Upload image from external URL
 * Downloads image, processes it, and uploads to storage
 */

import "server-only";
import { processImage, DEFAULT_IMAGE_CONFIG, type ImageProcessingConfig } from "@/lib/media/imageProcessor";
import { buildMasterFilename, buildMediaStem } from "@/server/media/mediaNaming";
import { writeRuntimeUpload } from "@/server/media/media-storage";
import { assertSafeRemoteUrl } from "@/lib/security/assertSafeRemoteUrl";
import { contentHashOf, findOwnedMediaByContentHash } from "@/lib/media/dedup";

export interface UploadFromUrlOptions {
  maxWidthOrHeight?: number;
  quality?: number;
  /**
   * Owning user id to dedup the downloaded bytes against before writing a new
   * file (per-owner). `undefined` disables dedup.
   */
  dedupOwnerId?: string;
}

export interface UploadedImageResult {
  url: string;
  width: number;
  height: number;
  blurhash: string;
  /** SHA-256 of the raw downloaded bytes — store it on the MediaAsset. */
  contentHash: string;
  /** Set when an existing asset was reused (no new file written). */
  deduplicatedAssetId?: string;
}

const DEFAULT_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadImageFromUrl(
  imageUrl: string,
  options: UploadFromUrlOptions = {}
): Promise<UploadedImageResult> {
  console.log("[uploadFromUrl] Downloading image from:", imageUrl);

  // SSRF protection: validate URL before fetching
  assertSafeRemoteUrl(imageUrl);

  // Download image with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let buffer: Buffer;
  let contentType: string;

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      // Never follow redirects — the redirect target would bypass the SSRF allowlist check
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    clearTimeout(timeoutId);

    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
      throw new Error(`Image URL redirected (status ${response.status}); redirects are not followed for security`);
    }

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    // Reject oversized responses before reading the body
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
      throw new Error(`Image too large: ${contentLength} bytes (max ${MAX_RESPONSE_BYTES})`);
    }

    // Stream body with hard size cap to prevent memory exhaustion
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error(`Image too large: exceeds ${MAX_RESPONSE_BYTES} bytes`);
      }
      chunks.push(value);
    }
    buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    console.log("[uploadFromUrl] Downloaded image, size:", buffer.length, "bytes");
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Image download timeout");
    }
    throw error;
  }

  // Dedup the raw downloaded bytes before any processing/storage write.
  const contentHash = contentHashOf(buffer);
  if (options.dedupOwnerId !== undefined) {
    const existing = await findOwnedMediaByContentHash(options.dedupOwnerId, contentHash);
    if (existing?.publicUrl) {
      console.log("[uploadFromUrl] Dedup hit — reusing existing asset", existing.id);
      return {
        url: existing.publicUrl,
        width: existing.width ?? 0,
        height: existing.height ?? 0,
        blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
        contentHash,
        deduplicatedAssetId: existing.id,
      };
    }
  }

  // Build processing config
  const config: ImageProcessingConfig = {
    ...DEFAULT_IMAGE_CONFIG,
    maxMasterWidth: options.maxWidthOrHeight ?? 1024,
    outputQuality: options.quality ?? 85,
  };

  // Process image through the same pipeline as regular uploads
  const processedImageSet = await processImage(buffer, contentType, config);

  console.log("[uploadFromUrl] Image processed:", {
    width: processedImageSet.master.width,
    height: processedImageSet.master.height,
    size: processedImageSet.master.size,
  });

  // Save master image
  const filename = buildMasterFilename(buildMediaStem({ type: "CONTEXTLESS" }));
  const masterSaved = await writeRuntimeUpload(filename, processedImageSet.master.buffer);

  console.log("[uploadFromUrl] Saved to storage:", masterSaved.publicUrl);

  return {
    url: masterSaved.publicUrl,
    width: processedImageSet.master.width,
    height: processedImageSet.master.height,
    blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj", // Fallback — processImage doesn't return blurhash
    contentHash,
  };
}

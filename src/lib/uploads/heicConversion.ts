import { normalizeUploadMimeType, resolveUploadMimeType } from "./uploadConfig";

/**
 * The one place client-side HEIC/HEIF handling lives. Every upload path
 * (both shared hooks, and any bypass that talks to `/api/upload` directly)
 * should call `convertHeicFileToJpegIfNeeded` before sending a file to the
 * server — prebuilt `sharp` (see `src/lib/media/imageProcessor.ts`) has no
 * HEVC decoder, and that's what almost every real iPhone HEIC photo is
 * compressed with, so an unconverted HEIC upload fails server-side no
 * matter what the client does otherwise.
 */

/** iPhones sometimes report an empty/generic MIME type for HEIC files, so the extension is checked too. */
export function isHeicFile(file: Pick<File, "name" | "type">): boolean {
  const normalizedMimeType = normalizeUploadMimeType(resolveUploadMimeType(file), file.name);
  const extension = file.name.split(".").pop()?.toLowerCase();
  return (
    normalizedMimeType === "image/heic" ||
    normalizedMimeType === "image/heif" ||
    extension === "heic" ||
    extension === "heif"
  );
}

const HEIC_CONVERSION_ERROR_MESSAGE =
  "Не удалось обработать HEIC-файл. Попробуйте другое фото или пришлите его в формате JPEG/PNG.";

function withJpegExtension(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, "");
  return `${withoutExtension || "photo"}.jpg`;
}

/**
 * Converts a HEIC/HEIF `File` to a JPEG `File` in the browser via `heic2any`
 * (dynamically imported — it pulls in a WASM HEIF decoder, so it must never
 * be part of the main bundle; see the dynamic `import()` below). Not a
 * no-op for non-HEIC files — callers are expected to check `isHeicFile`
 * first, same as every existing upload path already did before this file
 * (they just skipped compression instead of actually converting).
 *
 * Any failure (corrupt file, unsupported HEIC variant, decoder error) is
 * re-thrown as one human-readable message — the caller doesn't need to
 * know the underlying library's error shape.
 */
export async function convertHeicFileToJpeg(file: File, quality = 0.9): Promise<File> {
  try {
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality });
    const blob = Array.isArray(result) ? result[0] : result;
    return new File([blob], withJpegExtension(file.name), { type: "image/jpeg" });
  } catch (error) {
    // Surface the real cause for diagnostics — the user-facing message stays generic.
    console.error("[heicConversion] heic2any failed:", error);
    throw new Error(HEIC_CONVERSION_ERROR_MESSAGE);
  }
}

/** Converts only if `isHeicFile(file)` — otherwise returns the same `File` unchanged. */
export async function convertHeicFileToJpegIfNeeded(file: File, quality = 0.9): Promise<File> {
  if (!isHeicFile(file)) return file;
  return convertHeicFileToJpeg(file, quality);
}

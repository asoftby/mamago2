import { normalizeUploadMimeType, resolveUploadMimeType } from "./uploadConfig";

/**
 * The one place client-side HEIC/HEIF conversion lives.
 *
 * `uploadMediaFile` is the mandatory transport boundary and always calls
 * `convertHeicFileToJpegIfNeeded` before sending bytes to the server. Higher-
 * level hooks may call the converter earlier because browser compression and
 * preview generation cannot consume HEIC reliably. Keeping the transport
 * boundary defensive means a new upload UI cannot accidentally send raw HEIC
 * just because it bypasses those higher-level hooks.
 *
 * Prebuilt `sharp` (see `src/lib/media/imageProcessor.ts`) has no HEVC
 * decoder, so an unconverted iPhone HEIC upload cannot be processed server-side.
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
 * Converts a HEIC/HEIF `File` to a JPEG `File` in the browser via `heic-to`
 * (dynamically imported — it pulls in a WASM HEIF decoder, so it must never
 * be part of the main bundle; see the dynamic `import()` below). Not a
 * no-op for non-HEIC files — callers are expected to check `isHeicFile`
 * first, same as every existing upload path already did before this file
 * (they just skipped compression instead of actually converting).
 *
 * Was `heic2any` — replaced because its bundled libheif is a ~2019 build
 * that can't decode modern iPhone HEIC (iOS 17/18 photos with an HDR gain
 * map fail with `ERR_LIBHEIF format not supported`, confirmed on a real
 * device photo). `heic-to` wraps a current libheif (1.19) and is still
 * maintained.
 *
 * `heic-to` also ships `isHeic()`, a magic-byte sniff — more reliable than
 * `isHeicFile`'s mime+extension heuristic, but async and requires reading
 * the file. It's used here as a second check on files that have *already*
 * committed to the conversion path (i.e. `isHeicFile` already said yes),
 * not as a universal check on every upload — that would mean paying for a
 * dynamic import + file read on every ordinary JPEG/PNG, for no benefit.
 * Its actual job: a file merely named/typed `.heic` that isn't real HEIC
 * data (e.g. a misnamed JPEG) gets passed through unconverted instead of
 * being fed into a decoder that would just fail on it.
 *
 * Any decode failure (corrupt file, unsupported HEIC variant) is re-thrown
 * as one human-readable message — the caller doesn't need to know the
 * underlying library's error shape.
 */
export async function convertHeicFileToJpeg(file: File, quality = 0.9): Promise<File> {
  try {
    const { heicTo, isHeic } = await import("heic-to");
    if (!(await isHeic(file))) {
      return file;
    }
    const blob = await heicTo({ blob: file, type: "image/jpeg", quality });
    return new File([blob], withJpegExtension(file.name), { type: "image/jpeg" });
  } catch (error) {
    // Surface the real cause for diagnostics — the user-facing message stays generic.
    console.error("[heicConversion] heic-to failed:", error);
    throw new Error(HEIC_CONVERSION_ERROR_MESSAGE);
  }
}

/** Converts only if `isHeicFile(file)` — otherwise returns the same `File` unchanged. */
export async function convertHeicFileToJpegIfNeeded(file: File, quality = 0.9): Promise<File> {
  if (!isHeicFile(file)) return file;
  return convertHeicFileToJpeg(file, quality);
}

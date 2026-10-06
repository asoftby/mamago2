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
 * Verifies the actual encoded bytes returned by the browser converter.
 * MIME metadata alone is not enough: a converter regression must never let
 * the original HEIC bytes be renamed to .jpg and sent to the server.
 */
export async function hasJpegSignature(blob: Blob): Promise<boolean> {
  const bytes = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
  return bytes.length === 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Converts a HEIC/HEIF `File` to a JPEG `File` in the browser via `heic-to`.
 *
 * Important: once `isHeicFile` has classified a browser file as HEIC/HEIF,
 * conversion is mandatory. Do not gate this with `heic-to.isHeic()`.
 * heic-to 1.5.2 only recognizes a subset of ISO-BMFF HEIC major brands in
 * that helper (for example it omits `heis`/`heim`), so a valid iPhone HEIC
 * can otherwise be returned unchanged and reach sharp as raw HEVC bytes.
 *
 * The converted blob is additionally checked for the JPEG magic signature.
 * Any decode failure, unsupported variant, or non-JPEG converter output is
 * surfaced as one human-readable client error and is never uploaded raw.
 */
export async function convertHeicFileToJpeg(file: File, quality = 0.9): Promise<File> {
  try {
    const { heicTo } = await import("heic-to");
    const blob = await heicTo({ blob: file, type: "image/jpeg", quality });
    if (!(blob instanceof Blob) || !(await hasJpegSignature(blob))) {
      throw new Error("HEIC converter did not return JPEG bytes");
    }
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

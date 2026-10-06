import { ALLOWED_UPLOAD_MIME_TYPE_SET, normalizeUploadMimeType } from "./uploadConfig";

/** Identify only supported raster containers before passing untrusted bytes to sharp. */
export function detectImageMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 6 && (buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a")) return "image/gif";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";

  if (buffer.length >= 16 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const boxSize = buffer.readUInt32BE(0);
    if (boxSize >= 16 && boxSize <= buffer.length && boxSize % 4 === 0) {
      const brands = [buffer.toString("ascii", 8, 12)];
      for (let offset = 16; offset + 4 <= boxSize; offset += 4) brands.push(buffer.toString("ascii", offset, offset + 4));
      if (brands.some((brand) => ["avif", "avis"].includes(brand))) return "image/avif";
      if (brands.some((brand) => ["heic", "heix", "heim", "heis"].includes(brand))) return "image/heic";
      if (brands.some((brand) => ["heif", "mif1", "msf1"].includes(brand))) return "image/heif";
    }
  }
  return null;
}

export function validateImageContent(buffer: Buffer, declaredMimeType: string | null | undefined): string {
  const actual = detectImageMimeType(buffer);
  if (!actual || !ALLOWED_UPLOAD_MIME_TYPE_SET.has(actual)) {
    throw new Error("Unsupported image content; only raster images are accepted");
  }
  const declared = normalizeUploadMimeType(declaredMimeType?.split(";", 1)[0]);
  if (declared && declared !== actual) {
    throw new Error(`Image content type mismatch: declared ${declared}, detected ${actual}`);
  }
  return actual;
}

export function validateUploadFileContent(buffer: Buffer, file: Pick<File, "name" | "type">): string {
  // A client can preserve photo.jpg while replacing its bytes and MIME with WebP.
  // The filename is metadata, not the format/security boundary.
  return validateImageContent(buffer, file.type);
}

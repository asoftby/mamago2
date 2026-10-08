const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

export function replaceUploadFilenameExtension(fileName: string, mimeType: string): string {
  const normalizedMime = mimeType.trim().toLowerCase().split(";", 1)[0];
  const extension = IMAGE_EXTENSION_BY_MIME[normalizedMime];
  if (!extension) return fileName;

  const baseName = fileName.replace(/\.[^./\\]+$/, "");
  return `${baseName || "image"}${extension}`;
}

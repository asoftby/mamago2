import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { basename, extname, join, posix, resolve, sep } from "path";

function resolveMediaStorageRoot(): string {
  const configuredRoot = process.env.MEDIA_STORAGE_ROOT?.trim();
  if (configuredRoot) {
    return resolve(configuredRoot);
  }

  return join(process.cwd(), "storage");
}

export const MEDIA_STORAGE_ROOT = resolveMediaStorageRoot();
export const MEDIA_UPLOADS_DIR = join(MEDIA_STORAGE_ROOT, "uploads");
export const MEDIA_FILE_ROUTE_PREFIX = "/api/media/file";
export const LEGACY_PUBLIC_UPLOADS_DIR = join(process.cwd(), "public", "uploads");

// Runtime uploads must not be written to public in dev/prod app runtime.

export function normalizeMediaFilename(input: string): string {
  const raw = basename(input).normalize("NFKC");
  const ext = extname(raw).toLowerCase();
  const stem = raw.slice(0, raw.length - ext.length);
  const safeStem = stem
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  const safeExt = ext.replace(/[^a-z0-9.]+/g, "");
  const fallbackStem = safeStem || "file";
  return `${fallbackStem}${safeExt || ""}`;
}

export async function ensureMediaUploadsDir(): Promise<void> {
  if (!existsSync(MEDIA_UPLOADS_DIR)) {
    await mkdir(MEDIA_UPLOADS_DIR, { recursive: true });
  }
}

export function buildMediaFilePublicUrl(relativePath: string): string {
  const normalized = posix
    .normalize(relativePath.replace(/\\/g, "/"))
    .replace(/^\/+/, "");
  const encodedPath = normalized
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${MEDIA_FILE_ROUTE_PREFIX}/${encodedPath}`;
}

export function resolveMediaStorageAbsolutePath(relativePath: string): string | null {
  const normalized = posix
    .normalize(relativePath.replace(/\\/g, "/"))
    .replace(/^\/+/, "");

  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized === "..") {
    return null;
  }

  const absolute = resolve(MEDIA_UPLOADS_DIR, normalized);
  if (absolute !== MEDIA_UPLOADS_DIR && !absolute.startsWith(`${MEDIA_UPLOADS_DIR}${sep}`)) {
    return null;
  }

  return absolute;
}

/**
 * Достаёт относительный путь файла в storage/uploads из URL вида
 * `/api/media/file/<segments>` или абсолютного `https://host/api/media/file/<segments>`.
 * Раньше обрабатывались только относительные строки — из‑за этого при сохранении
 * полного URL в publicUrl/storageKey маршрут file/* давал 404 (authorizedPath === null).
 */
export function extractMediaRelativePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const marker = `${MEDIA_FILE_ROUTE_PREFIX}/`;
  const idx = trimmed.indexOf(marker);
  if (idx === -1) {
    return null;
  }

  let encoded = trimmed.slice(idx + marker.length);
  if (!encoded) return null;
  encoded = encoded.split(/[?#]/)[0] ?? "";
  if (!encoded) return null;

  const decoded = encoded
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("/");

  return decoded || null;
}

export function resolveStoredMediaPath(url: string | null | undefined): string | null {
  const relativePath = extractMediaRelativePathFromUrl(url);
  if (!relativePath) {
    return null;
  }

  return resolveMediaStorageAbsolutePath(relativePath);
}

export function resolveLegacyPublicUploadPath(url: string | null | undefined): string | null {
  if (!url?.startsWith("/uploads/")) {
    return null;
  }

  const relativePath = url.slice("/uploads/".length);
  const normalized = posix
    .normalize(relativePath.replace(/\\/g, "/"))
    .replace(/^\/+/, "");

  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized === "..") {
    return null;
  }

  const absolute = resolve(LEGACY_PUBLIC_UPLOADS_DIR, normalized);
  if (absolute !== LEGACY_PUBLIC_UPLOADS_DIR && !absolute.startsWith(`${LEGACY_PUBLIC_UPLOADS_DIR}${sep}`)) {
    return null;
  }

  return absolute;
}

export async function writeRuntimeUpload(
  filename: string,
  data: Uint8Array | Buffer,
): Promise<{ filename: string; absolutePath: string; publicUrl: string }> {
  try {
    await ensureMediaUploadsDir();

    const safeFilename = normalizeMediaFilename(filename);
    const absolutePath = resolveMediaStorageAbsolutePath(safeFilename);
    if (!absolutePath) {
      throw new Error("Invalid runtime upload filename");
    }

    await writeFile(absolutePath, data);

    return {
      filename: safeFilename,
      absolutePath,
      publicUrl: buildMediaFilePublicUrl(safeFilename),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`STORAGE_WRITE_FAILED: ${message}`);
  }
}

export function mimeTypeFromFilename(filename: string): string {
  const ext = extname(filename).toLowerCase();
  switch (ext) {
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".avif":
      return "image/avif";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return "application/octet-stream";
  }
}

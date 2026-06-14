const EXTENSION_TO_MIME_TYPE = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".avif", "image/avif"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
]);

export const UPLOAD_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

export const UPLOAD_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".heic",
  ".heif",
] as const;

export const MAX_IMAGE_FILE_SIZE_MB = 10;
export const MAX_IMAGE_FILE_SIZE_BYTES = MAX_IMAGE_FILE_SIZE_MB * 1024 * 1024;
export const MAX_IMAGE_FILES = 12;

export const ACCEPTED_IMAGE_MIME_TYPES = UPLOAD_IMAGE_MIME_TYPES;
export const ACCEPTED_IMAGE_FORMATS = UPLOAD_IMAGE_EXTENSIONS;

export const UPLOAD_MAX_FILE_SIZE_MB = MAX_IMAGE_FILE_SIZE_MB;
export const UPLOAD_MAX_FILE_SIZE = MAX_IMAGE_FILE_SIZE_BYTES;

export const MAX_UPLOAD_SIZE_MB = UPLOAD_MAX_FILE_SIZE_MB;
export const MAX_UPLOAD_SIZE_BYTES = UPLOAD_MAX_FILE_SIZE;

export const ALLOWED_UPLOAD_MIME_TYPES = ACCEPTED_IMAGE_MIME_TYPES;
export const ALLOWED_UPLOAD_MIME_TYPE_SET = new Set<string>(ACCEPTED_IMAGE_MIME_TYPES);

export const UPLOAD_IMAGE_ACCEPT = [
  "image/jpeg",
  "image/jpg",
  ...UPLOAD_IMAGE_MIME_TYPES.filter((type) => type !== "image/jpeg"),
  ...UPLOAD_IMAGE_EXTENSIONS,
].join(",");

export const UPLOAD_IMAGE_FORMATS_LABEL = "JPEG, JPG, PNG, WebP, GIF, AVIF, HEIC, HEIF";

export function getUploadFileSizeLimitLabel(): string {
  return `${MAX_IMAGE_FILE_SIZE_MB} МБ`;
}

export function getUploadFileCountLimitLabel(maxFiles: number = MAX_IMAGE_FILES): string {
  return `${maxFiles} ${maxFiles === 1 ? "файл" : "файлов"}`;
}

export function getUploadHintText(maxFiles: number = MAX_IMAGE_FILES, includeFileCount: boolean = true): string {
  const base = `Поддерживаются ${UPLOAD_IMAGE_FORMATS_LABEL}. До ${getUploadFileSizeLimitLabel()}`;
  return includeFileCount ? `${base}, максимум ${getUploadFileCountLimitLabel(maxFiles)}.` : `${base}.`;
}

export function getFileTooLargeMessage(): string {
  return `Файл слишком большой. Максимальный размер — ${getUploadFileSizeLimitLabel()}.`;
}

export function normalizeUploadMimeType(
  mimeType: string | null | undefined,
  fileName?: string | null | undefined,
): string | null {
  const value = mimeType?.trim().toLowerCase();
  if (!value || value === "application/octet-stream") {
    return inferUploadMimeTypeFromFilename(fileName) ?? null;
  }

  if (value === "image/jpg") {
    return "image/jpeg";
  }

  return value;
}

export function inferUploadMimeTypeFromFilename(filename: string | null | undefined): string | null {
  const trimmed = filename?.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex === -1) {
    return null;
  }

  return EXTENSION_TO_MIME_TYPE.get(trimmed.slice(dotIndex)) ?? null;
}

export function resolveUploadMimeType(file: Pick<File, "name" | "type">): string | null {
  const normalizedType = normalizeUploadMimeType(file.type, file.name);
  if (normalizedType && ALLOWED_UPLOAD_MIME_TYPE_SET.has(normalizedType)) {
    return normalizedType;
  }

  const inferredType = inferUploadMimeTypeFromFilename(file.name);
  if (inferredType && ALLOWED_UPLOAD_MIME_TYPE_SET.has(inferredType)) {
    return inferredType;
  }

  return normalizedType ?? inferredType;
}

export function validateUploadMimeType(file: Pick<File, "name" | "type">): boolean {
  return resolveUploadMimeType(file) !== null;
}

export function isAllowedUploadMimeType(
  mimeType: string | null | undefined,
  fileName?: string | null | undefined,
): boolean {
  const normalizedType = normalizeUploadMimeType(mimeType, fileName);
  return normalizedType ? ALLOWED_UPLOAD_MIME_TYPE_SET.has(normalizedType) : false;
}

export function getUploadErrorMessage(errorCode: string | null | undefined, fallback?: string): string {
  switch (errorCode) {
    case "FILE_REQUIRED":
      return "Выберите файл для загрузки.";
    case "INVALID_FILE_TYPE":
      return "Неподдерживаемый формат файла.";
    case "FILE_TOO_LARGE":
      return getFileTooLargeMessage();
    case "UNAUTHORIZED":
      return "Нужно войти в систему, чтобы загружать файлы.";
    case "FORBIDDEN":
      return "Недостаточно прав для загрузки файла.";
    case "WIZARD_SESSION_REQUIRED":
      return "Для этой загрузки нужна активная сессия мастера.";
    case "STORAGE_WRITE_FAILED":
      return "Не удалось сохранить файл на сервере.";
    case "IMAGE_PROCESSING_FAILED":
      return fallback || "Не удалось обработать изображение.";
    case "DATABASE_WRITE_FAILED":
      return "Файл загружен, но не удалось сохранить запись в базе данных.";
    case "UPLOAD_FAILED":
      return fallback || "Не удалось загрузить файл.";
    default:
      return fallback || "Не удалось загрузить файл.";
  }
}

export function detectUploadMimeTypeFromBuffer(buffer: Buffer): string | null {
  const brand = buffer.slice(4, 8).toString("ascii");
  const majorBrand = buffer.slice(8, 12).toString("ascii");

  if (brand === "ftyp") {
    if (majorBrand === "heic" || majorBrand === "heix" || majorBrand === "heim" || majorBrand === "heis") {
      return "image/heic";
    }

    if (majorBrand === "heif" || majorBrand === "mif1" || majorBrand === "msf1") {
      return "image/heif";
    }
  }

  return null;
}

/**
 * Prisma ActivityImage.id — cuid (~25 символов, с префиксом `c`).
 * В бизнес-мастере в coverImageId иногда пишут имя файла из Media, а не id записи галереи.
 */
function looksLikePrismaCuid(id: string): boolean {
  return /^c[a-z0-9]{24}$/i.test(id);
}

function normalizeActivityImageUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return raw;
  if (raw.startsWith("uploads/")) return `/${raw}`;

  return `/api/media/${encodeURIComponent(raw)}`;
}

/**
 * Единая логика primary/cover для Activity: сначала запись по coverImageId в галерее,
 * затем coverImageId как имя файла Media (`/api/media/...`), абсолютный/корневой URL,
 * денормализованный coverImageUrl, затем первое изображение по порядку.
 */
export function resolveActivityCoverUrl(input: {
  coverImageId: string | null;
  coverImageUrl: string | null;
  images: Array<{ id: string; url: string }>;
}): string | null {
  const rawId = input.coverImageId?.trim();
  if (rawId) {
    const matched = input.images.find((i) => i.id === rawId);
    if (matched?.url) return normalizeActivityImageUrl(matched.url);

    const normalizedRawId = normalizeActivityImageUrl(rawId);
    if (/^https?:\/\//i.test(rawId) || rawId.startsWith("/")) return normalizedRawId;
    if (!looksLikePrismaCuid(rawId)) {
      return normalizedRawId;
    }
  }

  const legacy = normalizeActivityImageUrl(input.coverImageUrl);
  if (legacy) return legacy;

  if (rawId) {
    const normalizedRawId = normalizeActivityImageUrl(rawId);
    if (normalizedRawId) return normalizedRawId;
  }

  return normalizeActivityImageUrl(input.images[0]?.url) ?? null;
}

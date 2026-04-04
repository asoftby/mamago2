/**
 * Prisma ActivityImage.id — cuid (~25 символов, с префиксом `c`).
 * В бизнес-мастере в coverImageId иногда пишут имя файла из Media, а не id записи галереи.
 */
function looksLikePrismaCuid(id: string): boolean {
  return /^c[a-z0-9]{24}$/i.test(id);
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
    if (matched?.url) return matched.url;

    if (/^https?:\/\//i.test(rawId)) return rawId;
    if (rawId.startsWith("/")) return rawId;
    if (!looksLikePrismaCuid(rawId)) {
      return `/api/media/${encodeURIComponent(rawId)}`;
    }
  }

  const legacy = input.coverImageUrl?.trim();
  if (legacy) return legacy;
  return input.images[0]?.url ?? null;
}

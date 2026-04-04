import type { PrismaClient } from "@prisma/client";

/** Сообщения для админки: уникальность жанра в рамках одной event category. */
export const MSG_GENRE_SLUG_IN_CATEGORY =
  "Жанр с таким slug уже существует в этой категории.";
export const MSG_GENRE_NAME_IN_CATEGORY =
  "Жанр с таким названием уже существует в этой категории.";

/**
 * Проверка, что в категории нет другой записи с тем же slug или тем же названием.
 * Глобальная уникальность slug не используется — только в связке с categoryId.
 */
export async function assertGenreUniqueInCategory(
  prisma: PrismaClient,
  input: {
    categoryId: string;
    slug: string;
    name: string;
    /** При обновлении — исключить текущую запись */
    excludeGenreId?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { categoryId, slug, name, excludeGenreId } = input;
  const idFilter = excludeGenreId ? { not: excludeGenreId } : undefined;

  const slugHit = await prisma.genre.findFirst({
    where: {
      categoryId,
      slug,
      ...(idFilter ? { id: idFilter } : {}),
    },
    select: { id: true },
  });
  if (slugHit) {
    return { ok: false, error: MSG_GENRE_SLUG_IN_CATEGORY };
  }

  const nameHit = await prisma.genre.findFirst({
    where: {
      categoryId,
      name,
      ...(idFilter ? { id: idFilter } : {}),
    },
    select: { id: true },
  });
  if (nameHit) {
    return { ok: false, error: MSG_GENRE_NAME_IN_CATEGORY };
  }

  return { ok: true };
}

import prisma from "@/lib/prisma";

/**
 * Активные жанры для выбранной категории (корень или лист — по `categoryId` в справочнике Genre).
 */
export async function getGenresByCategory(categoryId: string) {
  return prisma.genre.findMany({
    where: { categoryId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      isActive: true,
    },
  });
}

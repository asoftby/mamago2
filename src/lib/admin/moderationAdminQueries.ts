import prisma from "@/lib/prisma";

/** Список городов для фильтров модерации (как на странице мест). */
export async function getModerationFilterCities() {
  return prisma.city.findMany({
    where: { isLegacyNonCity: false },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

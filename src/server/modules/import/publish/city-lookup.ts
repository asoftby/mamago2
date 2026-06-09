/**
 * City lookup для publish phase.
 * Ищет City по имени — не создаёт новые города.
 */

import prisma from "@/lib/prisma";

/**
 * Найти cityId по имени города (case-insensitive).
 * Возвращает null если не найден — не бросает ошибку.
 */
export async function lookupCityId(cityName: string): Promise<string | null> {
  if (!cityName.trim()) return null;

  const city = await prisma.city.findFirst({
    where: {
      isLegacyNonCity: false,
      name: { equals: cityName.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });

  return city?.id ?? null;
}

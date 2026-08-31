import type { Prisma } from "@prisma/client";

export function buildArticleEditorCityOptionsWhere(selectedCityIds: string[]): Prisma.CityWhereInput {
  return {
    isLegacyNonCity: false,
    OR: [
      { isActive: true },
      ...(selectedCityIds.length ? [{ id: { in: selectedCityIds } }] : []),
    ],
  };
}

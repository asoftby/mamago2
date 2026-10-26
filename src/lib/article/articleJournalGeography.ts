import type { Prisma } from "@prisma/client";

/** Ranking order for a city's journal; each bucket is sorted by publication date. */
export const JOURNAL_GROUPS = ["CITY", "REGION", "OTHER_CITY", "BELARUS"] as const;
export type JournalGeographyGroup = (typeof JOURNAL_GROUPS)[number];

export const JOURNAL_GROUP_LABELS: Record<JournalGeographyGroup, string> = {
  CITY: "Ваш город",
  REGION: "Ваш регион",
  OTHER_CITY: "Другие города Беларуси",
  BELARUS: "Беларусь и другие регионы",
};

export type JournalCity = { id: string; regionId?: string | null };

export function buildJournalGeographyBuckets(
  city: JournalCity,
): Array<{ group: JournalGeographyGroup; where: Prisma.ArticleWhereInput }> {
  // Additional editorial targets also count as locally relevant.
  const local: Prisma.ArticleWhereInput = {
    OR: [
      { geoScope: "CITY", cityId: city.id },
      { additionalGeographyTargets: { some: { type: "CITY", cityId: city.id } } },
    ],
  };
  const regionMatch: Prisma.ArticleWhereInput = city.regionId
    ? {
        OR: [
          { geoScope: "REGION", regionId: city.regionId },
          { additionalGeographyTargets: { some: { type: "REGION", regionId: city.regionId } } },
        ],
      }
    : { id: { in: [] } };
  const regional: Prisma.ArticleWhereInput = { AND: [regionMatch, { NOT: local }] };
  const otherCity: Prisma.ArticleWhereInput = {
    AND: [{ geoScope: "CITY" }, { NOT: local }, { NOT: regionMatch }],
  };
  const remaining: Prisma.ArticleWhereInput = {
    NOT: { OR: [local, regionMatch, { geoScope: "CITY" }] },
  };
  return [
    { group: "CITY", where: local },
    { group: "REGION", where: regional },
    { group: "OTHER_CITY", where: otherCity },
    { group: "BELARUS", where: remaining },
  ];
}

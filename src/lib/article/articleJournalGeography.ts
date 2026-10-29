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

/** Territory view of the page: the city, and the region with every city inside it. */
export type JournalTerritories = {
  cityTerritoryId: string | null;
  regionTerritoryId: string | null;
  regionScopeIds: readonly string[];
};

type Bucket = { group: JournalGeographyGroup; where: Prisma.ArticleWhereInput };

function assemble(local: Prisma.ArticleWhereInput, regionMatch: Prisma.ArticleWhereInput): Bucket[] {
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

const NONE: Prisma.ArticleWhereInput = { id: { in: [] } };

/** Territory-based buckets: "region" now also covers the other cities of the region. */
export function buildJournalGeographyBucketsByTerritory(geo: JournalTerritories): Bucket[] {
  const local: Prisma.ArticleWhereInput = geo.cityTerritoryId
    ? {
        OR: [
          { geoScope: "CITY", territoryId: geo.cityTerritoryId },
          { additionalGeographyTargets: { some: { type: "CITY", territoryId: geo.cityTerritoryId } } },
        ],
      }
    : NONE;
  const regionIds = geo.regionScopeIds.length > 0 ? { in: [...geo.regionScopeIds] } : null;
  const regionMatch: Prisma.ArticleWhereInput =
    geo.regionTerritoryId && regionIds
      ? {
          OR: [
            { geoScope: "REGION", regionTerritoryId: geo.regionTerritoryId },
            { geoScope: "CITY", territoryId: regionIds },
            {
              additionalGeographyTargets: {
                some: {
                  OR: [
                    { type: "REGION", regionTerritoryId: geo.regionTerritoryId },
                    { type: "CITY", territoryId: regionIds },
                  ],
                },
              },
            },
          ],
        }
      : NONE;
  return assemble(local, regionMatch);
}

/** Legacy (City/Region FK) buckets: used only when the page has no resolvable Territory. */
export function buildJournalGeographyBuckets(city: JournalCity): Bucket[] {
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
    : NONE;
  return assemble(local, regionMatch);
}

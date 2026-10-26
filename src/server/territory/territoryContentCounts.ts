import { ActivityType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  getPublicListingActivityWhere,
  getPublicPublishedArticleWhere,
  getPublicPublishedOfferWhere,
  getPublicPublishedPlaceWhere,
  getPublicRouteIndexWhere,
} from "@/server/public/publicContentVisibility";

/** Published content a territory holds, per product section. */
export type TerritorySectionCounts = {
  events: number;
  /** Non-event activities: courses and permanent offerings («Занятия»). */
  classes: number;
  places: number;
  offers: number;
  routes: number;
  articles: number;
};

export const EMPTY_SECTION_COUNTS: TerritorySectionCounts = {
  events: 0, classes: 0, places: 0, offers: 0, routes: 0, articles: 0,
};

export function totalSectionCounts(counts: TerritorySectionCounts): number {
  return counts.events + counts.classes + counts.places + counts.offers + counts.routes + counts.articles;
}

export function addSectionCounts(a: TerritorySectionCounts, b: TerritorySectionCounts): TerritorySectionCounts {
  return {
    events: a.events + b.events, classes: a.classes + b.classes, places: a.places + b.places,
    offers: a.offers + b.offers, routes: a.routes + b.routes, articles: a.articles + b.articles,
  };
}

export type TerritoryCountsDb = Pick<typeof prisma, "activity" | "place" | "offer" | "route" | "article">;

function activityInTerritory(territoryId: string): Prisma.ActivityWhereInput {
  return {
    OR: [
      { territoryId },
      { place: { territoryId } },
      { venue: { territoryId } },
      { venue: { place: { territoryId } } },
    ],
  };
}

/** Article belongs to a territory through its main city/region or any additional geography target. */
function articleInTerritory(territoryId: string): Prisma.ArticleWhereInput {
  return {
    OR: [
      { territoryId },
      { regionTerritoryId: territoryId },
      { additionalGeographyTargets: { some: { OR: [{ territoryId }, { regionTerritoryId: territoryId }] } } },
    ],
  };
}

/**
 * Counts what each territory itself holds (not its children). Uses the mirrored `territoryId`
 * columns, so it keeps working unchanged after the read switch.
 */
export async function countPublicContentForTerritory(
  territoryId: string,
  db: TerritoryCountsDb = prisma,
): Promise<TerritorySectionCounts> {
  const listing = (getPublicListingActivityWhere().AND ?? []) as Prisma.ActivityWhereInput[];
  const activities = (types: ActivityType[]) =>
    db.activity.count({
      where: { AND: [{ type: { in: types } }, ...listing, activityInTerritory(territoryId)] },
    });
  const [events, classes, places, offers, routes, articles] = await Promise.all([
    activities([ActivityType.EVENT]),
    activities([ActivityType.COURSE, ActivityType.PERMANENT]),
    db.place.count({ where: { territoryId, AND: getPublicPublishedPlaceWhere().AND } }),
    db.offer.count({ where: { AND: [getPublicPublishedOfferWhere(), { place: { territoryId } }] } }),
    db.route.count({ where: { AND: [getPublicRouteIndexWhere(), { territoryId }] } }),
    db.article.count({ where: { AND: [getPublicPublishedArticleWhere(), articleInTerritory(territoryId)] } }),
  ]);
  return { events, classes, places, offers, routes, articles };
}

/** National articles (geoScope COUNTRY) belong to the country territory. */
export async function countNationalArticles(db: TerritoryCountsDb = prisma): Promise<number> {
  return db.article.count({ where: { AND: [getPublicPublishedArticleWhere(), { geoScope: "COUNTRY" }] } });
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; value: Map<string, TerritorySectionCounts> } | null = null;

export function invalidateTerritoryContentCountsCache(): void {
  cache = null;
}

/** Counts for the given city/region territories, cached in memory for 5 minutes. */
export async function countPublicContentByTerritory(
  territoryIds: readonly string[],
  db: TerritoryCountsDb = prisma,
): Promise<Map<string, TerritorySectionCounts>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS && territoryIds.every((id) => cache!.value.has(id))) {
    return cache.value;
  }
  const entries = await Promise.all(
    territoryIds.map(async (id) => [id, await countPublicContentForTerritory(id, db)] as const),
  );
  const value = new Map(entries);
  cache = { at: Date.now(), value };
  return value;
}

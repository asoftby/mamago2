import { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicListingActivityWhere } from "@/server/public/publicContentVisibility";
import { activityInCityWhere } from "@/server/discovery/activityInCityWhere";
import { activityInTerritoryScopeWhere, resolveTerritoryScope } from "@/server/territory/territoryScope";
import { getEventEngagementScores } from "@/server/discovery/eventEngagementScores";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { zonedDayRange } from "@/server/services/planSuggestions.service";
import { TravelEstimator } from "@/features/my-plan/lib/dayScenario/travel";
import type { PoolEvent } from "@/features/my-plan/lib/dayScenario/types";
import { toPoolEvent, type PoolActivityRow } from "./poolMapping";
import { createTtlCache } from "./ttlCache";

export const POOL_TTL_MS = 10 * 60_000;
export const POOL_MAX_ENTRIES = 64;
/** One city-day: published EVENTs with a confirmed session. Bounded to protect memory. */
export const POOL_MAX_EVENTS = 200;

export type DayScenarioPool = {
  citySlug: string;
  date: string;
  events: PoolEvent[];
  /** Shared by every build on this pool, so pair legs are computed once. */
  estimator: TravelEstimator;
  loadedAtMs: number;
};

const placeGeoSelect = {
  lat: true,
  lng: true,
  geoCell6: true,
  geoCell5: true,
  shortAddress: true,
  formattedAddr: true,
  customAddress: true,
} as const;

/** The only database read of a build: audience-agnostic public catalog facts. */
export async function loadDayScenarioPool(citySlug: string, date: string, nowMs = Date.now()): Promise<DayScenarioPool> {
  const empty: DayScenarioPool = { citySlug, date, events: [], estimator: new TravelEstimator(), loadedAtMs: nowMs };
  const city = await findCityBySlug(citySlug.toLowerCase());
  if (!city) return empty;
  const scope = await resolveTerritoryScope(citySlug);
  const range = zonedDayRange(date, DEFAULT_TZ);
  const lower = new Date(Math.max(range.start.getTime(), nowMs));
  if (lower >= range.end) return empty;

  const pub = getPublicListingActivityWhere(new Date(nowMs));
  const rows = (await prisma.activity.findMany({
    where: {
      AND: [
        { type: ActivityType.EVENT },
        scope ? activityInTerritoryScopeWhere(scope.territoryIds) : activityInCityWhere(city.id),
        ...((pub.AND ?? []) as object[]),
        { sessions: { some: { startsAt: { gte: lower, lt: range.end }, withdrawnAt: null } } },
      ],
    },
    take: POOL_MAX_EVENTS,
    orderBy: [{ nextOccurrenceAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      coverImageUrl: true,
      ageLabel: true,
      ageTags: true,
      agePolicy: true,
      eventCategory: { select: { id: true, nameRu: true } },
      priceFrom: true,
      priceTo: true,
      priceText: true,
      currency: true,
      scheduleJson: true,
      format: true,
      discoverySignalIds: true,
      place: { select: placeGeoSelect },
      venue: { select: { addressLine: true, lat: true, lng: true, place: { select: placeGeoSelect } } },
      metroStation: { select: { lat: true, lng: true } },
      sessions: {
        where: { startsAt: { gte: lower, lt: range.end }, withdrawnAt: null },
        select: { startsAt: true },
        orderBy: { startsAt: "asc" },
      },
    },
  })) as unknown as PoolActivityRow[];

  const scores = await getEventEngagementScores(rows.map((row) => row.id));
  const events = rows
    .map((row) => toPoolEvent(row, scores.get(row.id) ?? 0))
    .filter((event): event is PoolEvent => event !== null);
  return { citySlug, date, events, estimator: new TravelEstimator(), loadedAtMs: nowMs };
}

const poolCache = createTtlCache<DayScenarioPool>({ ttlMs: POOL_TTL_MS, maxEntries: POOL_MAX_ENTRIES });

export async function getDayScenarioPool(citySlug: string, date: string) {
  return poolCache.get(`${citySlug.toLowerCase()}|${date}`, () => loadDayScenarioPool(citySlug, date));
}

export function clearDayScenarioPoolCache(): void {
  poolCache.clear();
}

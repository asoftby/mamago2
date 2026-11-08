import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicListingActivityWhere, getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";
import { activityInCityWhere } from "@/server/discovery/activityInCityWhere";
import { activityInTerritoryScopeWhere, placeInTerritoryScopeWhere, resolveTerritoryScope } from "@/server/territory/territoryScope";
import { getEventEngagementScores } from "@/server/discovery/eventEngagementScores";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { zonedDayRange } from "@/server/services/planSuggestions.service";
import { TravelEstimator } from "@/features/my-plan/lib/dayScenario/travel";
import type { PoolEvent } from "@/features/my-plan/lib/dayScenario/types";
import {
  hasStaleStoredCells,
  hasStaleStoredPlaceCells,
  toPoolEvent,
  toPoolPlace,
  toVirtualPoolEvent,
  type PoolActivityRow,
  type PoolPlaceRow,
} from "./poolMapping";
import { createTtlCache } from "./ttlCache";

export const POOL_TTL_MS = 10 * 60_000;
export const POOL_MAX_ENTRIES = 64;
/** One city-day: published EVENTs with a confirmed session. Bounded to protect memory. */
export const POOL_MAX_EVENTS = 200;
/** Published filler places with coordinates for a city-day. Bounded to protect memory. */
export const POOL_MAX_PLACES = 400;
/** Published events with a schedule but no ActivitySession rows: candidates for a virtual session. */
export const POOL_MAX_VIRTUAL_CANDIDATES = 150;

export type DayScenarioPool = {
  citySlug: string;
  date: string;
  /** Dated events and filler places (`kind`). */
  events: PoolEvent[];
  /** Number of filler places among `events`. */
  placeCount: number;
  /** Number of events among `events` whose time comes from `scheduleJson` (no ActivitySession). */
  virtualCount: number;
  /** Shared by every build on this pool, so pair legs are computed once. */
  estimator: TravelEstimator;
  loadedAtMs: number;
  /** Places whose stored geoCell disagreed with lat/lng (recomputed in memory). */
  staleGeoCells: number;
};

const placeGeoSelect = {
  lat: true,
  lng: true,
  geoCell6: true,
  geoCell5: true,
  shortAddress: true,
  formattedAddr: true,
  customAddress: true,
  city: { select: { slug: true } },
} as const;

const activityPoolSelect = {
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
} as const;

/** The only database read of a build: audience-agnostic public catalog facts. */
export async function loadDayScenarioPool(citySlug: string, date: string, nowMs = Date.now()): Promise<DayScenarioPool> {
  const empty: DayScenarioPool = { citySlug, date, events: [], placeCount: 0, virtualCount: 0, estimator: new TravelEstimator(), loadedAtMs: nowMs, staleGeoCells: 0 };
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
      ...activityPoolSelect,
      sessions: {
        where: { startsAt: { gte: lower, lt: range.end }, withdrawnAt: null },
        select: { startsAt: true },
        orderBy: { startsAt: "asc" },
      },
    },
  })) as unknown as PoolActivityRow[];

  // Events the writer never materialized (legacy import, edit that bypassed the sync): no
  // ActivitySession row at all, but a schedule. A row with only withdrawn/past sessions is NOT a
  // candidate - a withdrawn session is a deliberate cancellation, never resurrected from the rules.
  const virtualRows = (await prisma.activity.findMany({
    where: {
      AND: [
        { type: ActivityType.EVENT },
        scope ? activityInTerritoryScopeWhere(scope.territoryIds) : activityInCityWhere(city.id),
        ...((pub.AND ?? []) as object[]),
        { scheduleJson: { not: Prisma.DbNull } },
        { sessions: { none: {} } },
      ],
    },
    take: POOL_MAX_VIRTUAL_CANDIDATES,
    orderBy: { createdAt: "desc" },
    select: activityPoolSelect,
  })) as unknown as Omit<PoolActivityRow, "sessions">[];

  const placeRows = (await prisma.place.findMany({
    where: {
      AND: [
        getPublicPublishedPlaceWhere(new Date(nowMs)),
        scope ? placeInTerritoryScopeWhere(scope.territoryIds) : { cityId: city.id },
        { lat: { not: null }, lng: { not: null } },
      ],
    },
    take: POOL_MAX_PLACES,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      lat: true,
      lng: true,
      geoCell6: true,
      geoCell5: true,
      shortAddress: true,
      formattedAddr: true,
      customAddress: true,
      primaryCategory: { select: { id: true, slug: true, nameRu: true } },
      agePolicy: true,
      ageTags: true,
      city: { select: { slug: true } },
      images: { select: { url: true, kind: true }, orderBy: { sortOrder: "asc" }, take: 3 },
      openingHours: {
        select: {
          mode: true,
          timezone: true,
          rules: {
            select: {
              dayOfWeek: true,
              isOpen: true,
              allDay: true,
              intervals: { select: { startTime: true, endTime: true }, orderBy: { sortOrder: "asc" } },
            },
          },
          exceptions: {
            where: { date },
            select: {
              date: true,
              isClosed: true,
              allDay: true,
              intervals: { select: { startTime: true, endTime: true }, orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
  })) as unknown as PoolPlaceRow[];

  const scores = await getEventEngagementScores([...rows, ...virtualRows].map((row) => row.id));
  const dated = rows
    .map((row) => toPoolEvent(row, scores.get(row.id) ?? 0))
    .filter((event): event is PoolEvent => event !== null);
  const virtual = virtualRows
    .map((row) => toVirtualPoolEvent(row, scores.get(row.id) ?? 0, date, DEFAULT_TZ, lower.getTime()))
    .filter((event): event is PoolEvent => event !== null);
  const fillers = placeRows.map((row) => toPoolPlace(row, date)).filter((event): event is PoolEvent => event !== null);
  const events = [...dated, ...virtual, ...fillers];
  const staleGeoCells =
    [...rows, ...virtualRows].filter((row) => hasStaleStoredCells(row)).length + placeRows.filter((row) => hasStaleStoredPlaceCells(row)).length;
  if (staleGeoCells > 0) {
    console.warn("[day-scenario-pool] stored Place.geoCell disagrees with lat/lng; recomputed in memory", {
      citySlug,
      date,
      staleGeoCells,
      hint: "run backfill:place-geo-cells -- --apply",
    });
  }
  return { citySlug, date, events, placeCount: fillers.length, virtualCount: virtual.length, estimator: new TravelEstimator(), loadedAtMs: nowMs, staleGeoCells };
}

const poolCache = createTtlCache<DayScenarioPool>({ ttlMs: POOL_TTL_MS, maxEntries: POOL_MAX_ENTRIES });

export async function getDayScenarioPool(citySlug: string, date: string) {
  return poolCache.get(`${citySlug.toLowerCase()}|${date}`, () => loadDayScenarioPool(citySlug, date));
}

export function clearDayScenarioPoolCache(): void {
  poolCache.clear();
}

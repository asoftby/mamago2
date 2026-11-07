import { geoCellsFor } from "@/lib/geo/geoCell";
import type { GeoPoint, PoolEvent, ScenarioCard } from "@/features/my-plan/lib/dayScenario/types";

export const DEFAULT_EVENT_DURATION_MIN = 90;

type PlaceGeo = {
  lat: number | null;
  lng: number | null;
  geoCell6: string | null;
  geoCell5: string | null;
  shortAddress: string | null;
  formattedAddr: string | null;
  customAddress: string | null;
};

export type PoolActivityRow = {
  id: string;
  slug: string | null;
  title: string;
  coverImageUrl: string | null;
  ageLabel: string | null;
  ageTags: string[];
  agePolicy: string;
  eventCategory: { id: string; nameRu: string } | null;
  priceFrom: number | null;
  priceTo: number | null;
  priceText: string | null;
  currency: string | null;
  scheduleJson: unknown;
  format: string | null;
  discoverySignalIds: string[];
  place: PlaceGeo | null;
  venue: { addressLine: string | null; lat: number | null; lng: number | null; place: PlaceGeo | null } | null;
  metroStation: { lat: number; lng: number } | null;
  sessions: { startsAt: Date }[];
};

/**
 * The engine never trusts stored cells: they are always derived from lat/lng here
 * (microseconds), so a Place whose coordinates changed while the Place extension
 * was off (or by a writer that bypassed it) still lands in the right cell. Stored
 * cells are only compared, see `hasStaleStoredCells`.
 */
function pointFrom(lat: number | null, lng: number | null, approximate: boolean): GeoPoint | null {
  const computed = geoCellsFor(lat, lng);
  if (!computed || lat == null || lng == null) return null;
  return { lat, lng, ...computed, approximate };
}

/** True when a Place carries stored cells that disagree with its own lat/lng. */
function placeHasStaleCells(place: PlaceGeo | null | undefined): boolean {
  if (!place || (place.geoCell6 == null && place.geoCell5 == null)) return false;
  const computed = geoCellsFor(place.lat, place.lng);
  return (computed?.geoCell6 ?? null) !== place.geoCell6 || (computed?.geoCell5 ?? null) !== place.geoCell5;
}

export function hasStaleStoredCells(row: Pick<PoolActivityRow, "place" | "venue">): boolean {
  return placeHasStaleCells(row.place) || placeHasStaleCells(row.venue?.place);
}

/**
 * Location of an event, best source first: its Place, the Place of its venue, the
 * venue's own coordinates, then the metro station (approximate, never for walking).
 */
export function resolveEventGeo(row: Pick<PoolActivityRow, "place" | "venue" | "metroStation">): GeoPoint | null {
  const { place, venue, metroStation } = row;
  return (
    (place ? pointFrom(place.lat, place.lng, false) : null) ??
    (venue?.place ? pointFrom(venue.place.lat, venue.place.lng, false) : null) ??
    (venue ? pointFrom(venue.lat, venue.lng, false) : null) ??
    (metroStation ? pointFrom(metroStation.lat, metroStation.lng, true) : null)
  );
}

function address(row: PoolActivityRow): string | null {
  const p = row.place ?? row.venue?.place ?? null;
  return p?.shortAddress ?? p?.formattedAddr ?? p?.customAddress ?? row.venue?.addressLine ?? null;
}

export function toPoolEvent(row: PoolActivityRow, engagementScore: number): PoolEvent | null {
  const sessionStartsMs = row.sessions.map((s) => s.startsAt.getTime()).sort((a, b) => a - b);
  if (sessionStartsMs.length === 0) return null;
  const card: ScenarioCard = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    coverImageUrl: row.coverImageUrl,
    ageLabel: row.ageLabel,
    categoryName: row.eventCategory?.nameRu ?? null,
    priceFrom: row.priceFrom,
    priceTo: row.priceTo,
    priceText: row.priceText,
    currency: row.currency,
    address: address(row),
  };
  return {
    activityId: row.id,
    card,
    sessionStartsMs,
    durationMin: DEFAULT_EVENT_DURATION_MIN,
    ageTags: row.ageTags,
    adultOnly: row.agePolicy === "ADULT_ONLY",
    engagementScore,
    scheduleJson: row.scheduleJson,
    categoryId: row.eventCategory?.id ?? null,
    discoverySignalIds: row.discoverySignalIds,
    format: row.format,
    geo: resolveEventGeo(row),
  };
}

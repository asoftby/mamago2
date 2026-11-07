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

function pointFrom(
  lat: number | null,
  lng: number | null,
  stored: { geoCell6: string | null; geoCell5: string | null } | null,
  approximate: boolean,
): GeoPoint | null {
  if (lat == null || lng == null) return null;
  // Cells are computed at write time and stored on Place; fall back to computing
  // them from the coordinates for rows that predate the backfill or bypassed the
  // Place extension (venue coordinates and metro stations never have stored cells).
  const geoCell6 = stored?.geoCell6 ?? null;
  const geoCell5 = stored?.geoCell5 ?? null;
  if (geoCell6 && geoCell5) return { lat, lng, geoCell6, geoCell5, approximate };
  const computed = geoCellsFor(lat, lng);
  if (!computed) return null;
  return { lat, lng, ...computed, approximate };
}

/**
 * Location of an event, best source first: its Place, the Place of its venue, the
 * venue's own coordinates, then the metro station (approximate, never for walking).
 */
export function resolveEventGeo(row: Pick<PoolActivityRow, "place" | "venue" | "metroStation">): GeoPoint | null {
  const { place, venue, metroStation } = row;
  return (
    (place ? pointFrom(place.lat, place.lng, place, false) : null) ??
    (venue?.place ? pointFrom(venue.place.lat, venue.place.lng, venue.place, false) : null) ??
    (venue ? pointFrom(venue.lat, venue.lng, null, false) : null) ??
    (metroStation ? pointFrom(metroStation.lat, metroStation.lng, null, true) : null)
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

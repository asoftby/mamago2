import { fromZonedTime } from "date-fns-tz";
import { geoCellsFor } from "@/lib/geo/geoCell";
import { extractScheduleOccurrences } from "@/lib/event/materializeScheduleSessions";
import { fillerDurationMin } from "@/features/my-plan/lib/dayScenario/fillers";
import {
  resolveDayAvailability,
  type HoursDay,
  type HoursMode,
  type PlaceHours,
} from "@/features/my-plan/lib/dayScenario/openingHours";
import type { GeoPoint, PlaceAvailability, PoolEvent, ScenarioCard } from "@/features/my-plan/lib/dayScenario/types";

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
    kind: "event",
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

// ---------- events without ActivitySession rows (virtual sessions) ----------

/**
 * Start times (epoch ms, ascending) the schedule rules put on `date` in `timeZone`, from
 * `now` onwards. Reuses the canonical `extractScheduleOccurrences` that also writes real
 * sessions, so a virtual start is exactly the session the writer would have created.
 */
export function virtualSessionStarts(scheduleJson: unknown, date: string, timeZone: string, notBeforeMs: number): number[] {
  const starts = extractScheduleOccurrences(scheduleJson)
    .filter((occurrence) => occurrence.date === date)
    .map((occurrence) => fromZonedTime(`${occurrence.date}T${occurrence.startTime}:00`, timeZone).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= notBeforeMs);
  return [...new Set(starts)].sort((a, b) => a - b);
}

/** A pool event whose single source of time is the schedule rules; null when none lands on the day. */
export function toVirtualPoolEvent(
  row: Omit<PoolActivityRow, "sessions">,
  engagementScore: number,
  date: string,
  timeZone: string,
  notBeforeMs: number,
): PoolEvent | null {
  const starts = virtualSessionStarts(row.scheduleJson, date, timeZone, notBeforeMs);
  if (starts.length === 0) return null;
  const event = toPoolEvent({ ...row, sessions: starts.map((ms) => ({ startsAt: new Date(ms) })) }, engagementScore);
  return event ? { ...event, virtualSession: true } : null;
}

// ---------- filler places ----------

export type PoolPlaceRow = {
  id: string;
  slug: string | null;
  title: string;
  lat: number | null;
  lng: number | null;
  geoCell6: string | null;
  geoCell5: string | null;
  shortAddress: string | null;
  formattedAddr: string | null;
  customAddress: string | null;
  primaryCategory: { id: string; slug: string; nameRu: string } | null;
  /** Stored age restrictions; enforced exactly like for events. */
  agePolicy: string;
  ageTags: string[];
  images: { url: string; kind: string }[];
  openingHours: {
    mode: HoursMode;
    timezone: string;
    rules: { dayOfWeek: HoursDay; isOpen: boolean; allDay: boolean; intervals: { startTime: string; endTime: string }[] }[];
    exceptions: { date: string; isClosed: boolean; allDay: boolean; intervals: { startTime: string; endTime: string }[] }[];
  } | null;
};

export function hasStaleStoredPlaceCells(row: Pick<PoolPlaceRow, "lat" | "lng" | "geoCell6" | "geoCell5">): boolean {
  return placeHasStaleCells({ ...row, shortAddress: null, formattedAddr: null, customAddress: null });
}

const MS_PER_MIN = 60_000;

function toAvailability(row: PoolPlaceRow, dateIso: string): PlaceAvailability | null {
  const hours: PlaceHours | null = row.openingHours;
  const day = resolveDayAvailability(hours, dateIso);
  if (day.kind === "closed") return null;
  if (day.kind === "always") return { kind: "always" };
  if (day.kind === "unknown") return { kind: "unknown" };
  const dayStartMs = fromZonedTime(`${dateIso}T00:00:00`, hours?.timezone ?? "Europe/Minsk").getTime();
  return {
    kind: "windows",
    windows: day.windows.map((w) => ({ startMs: dayStartMs + w.startMin * MS_PER_MIN, endMs: dayStartMs + w.endMin * MS_PER_MIN })),
  };
}

/**
 * A published place as a day-scenario filler. Null when it cannot be offered that day:
 * no usable coordinates, by-appointment / temporarily closed, or closed on the date.
 * A place with no hours record is kept (availability "unknown") and flagged for the UI.
 */
export function toPoolPlace(row: PoolPlaceRow, dateIso: string): PoolEvent | null {
  const geo = pointFrom(row.lat, row.lng, false);
  if (!geo) return null;
  const availability = toAvailability(row, dateIso);
  if (!availability) return null;
  const cover = row.images.find((image) => image.kind !== "LOGO") ?? row.images[0] ?? null;
  const card: ScenarioCard = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    coverImageUrl: cover?.url ?? null,
    ageLabel: null,
    categoryName: row.primaryCategory?.nameRu ?? null,
    priceFrom: null,
    priceTo: null,
    priceText: null,
    currency: null,
    address: row.shortAddress ?? row.formattedAddr ?? row.customAddress ?? null,
  };
  return {
    kind: "place",
    availability,
    uncategorized: row.primaryCategory == null,
    activityId: row.id,
    card,
    sessionStartsMs: [],
    durationMin: fillerDurationMin(row.primaryCategory),
    ageTags: row.ageTags,
    adultOnly: row.agePolicy === "ADULT_ONLY",
    engagementScore: 0,
    scheduleJson: null,
    categoryId: row.primaryCategory?.id ?? null,
    discoverySignalIds: [],
    format: null,
    geo,
  };
}

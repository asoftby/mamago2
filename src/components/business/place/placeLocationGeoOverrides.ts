/**
 * Pure helpers for `PlaceLocationPicker`'s manual/auto district & metro
 * override state — kept React-free so the transition logic (when a manual
 * override should survive a re-enrichment vs. be cleared, and whether an
 * async enrichment response is still allowed to apply) is testable without
 * mounting the component or mocking fetch/React state.
 */

import { haversineMeters } from "@/lib/geo/haversineMeters";

/** A location does not "move" for override-invalidation purposes below this drift. */
export const GEO_POINT_DRIFT_TOLERANCE_M = 1;

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Manually-picked district/metro fields, as sent to the parent `onUpdate` patch. */
export interface ManualGeoOverrides {
  districtManualId: string | null;
  metroManualId: string | null;
  metroManualDistanceM: number | null;
}

/** Full local geo-enrichment state tracked by `PlaceLocationPicker`. */
export interface GeoOverrideState extends ManualGeoOverrides {
  districtAutoId: string | null;
  metroAutoId: string | null;
  metroAutoDistanceM: number | null;
}

/**
 * The exact patch sent to `onUpdate` to clear manual overrides. Always all
 * three fields as explicit `null`s — never omitted keys — so the parent's
 * merge (and the persisted record) can't be left holding a stale manual
 * pick alongside a fresh auto-detected one.
 */
export const MANUAL_GEO_OVERRIDE_RESET_PATCH: ManualGeoOverrides = {
  districtManualId: null,
  metroManualId: null,
  metroManualDistanceM: null,
};

/**
 * Whether two points are "the same" location within `toleranceMeters`.
 * Used instead of a direct float comparison: re-geocoding, marker
 * re-renders, or map/pin rounding can nudge coordinates by sub-meter float
 * noise without the user actually moving the pin.
 */
export function isSameGeoPoint(
  a: GeoPoint | null,
  b: GeoPoint | null,
  toleranceMeters: number = GEO_POINT_DRIFT_TOLERANCE_M,
): boolean {
  if (!a || !b) return false;
  return haversineMeters(a.lat, a.lng, b.lat, b.lng) < toleranceMeters;
}

/**
 * Whether a location update should invalidate manually-picked district/metro
 * overrides: true when there's no prior point on record, or the new point
 * is a real movement (beyond drift tolerance) from the prior one. False
 * when re-enriching the same point (e.g. a re-render or marker snap) —
 * re-enrichment of an unchanged point must never silently drop a manual
 * pick.
 */
export function shouldClearManualGeoOverrides(
  previousPoint: GeoPoint | null,
  nextPoint: GeoPoint,
  toleranceMeters: number = GEO_POINT_DRIFT_TOLERANCE_M,
): boolean {
  return !isSameGeoPoint(previousPoint, nextPoint, toleranceMeters);
}

/**
 * Builds the `onUpdate` patch for a location transition: the new location
 * fields, plus an explicit manual-override reset when the move invalidates
 * prior manual picks.
 *
 * This exists so the reset — when needed — travels in the SAME logical
 * patch as the location change, decided synchronously before enrichment
 * ever starts. It must never arrive later, alone, from the async
 * enrichment response: a user can pick a new manual district/metro for the
 * new point WHILE that response is still in flight, and a reset arriving
 * after that pick would silently erase it.
 */
export function buildLocationTransitionPatch(
  locationFields: Record<string, unknown>,
  clearManualOverrides: boolean,
): Record<string, unknown> {
  return clearManualOverrides
    ? { ...locationFields, ...MANUAL_GEO_OVERRIDE_RESET_PATCH }
    : locationFields;
}

/**
 * Whether an in-flight enrichment response is stale and must not apply its
 * auto-derived fields: true once a newer location request has started
 * since this response's request was issued.
 *
 * Guards two races: a slow response for an OLD point overwriting state
 * that's already moved on to a NEWER point, and two overlapping requests
 * (e.g. B then C) resolving out of order — only the response matching the
 * CURRENT (latest-started) request may ever apply.
 */
export function isStaleEnrichmentResponse(requestSeq: number, latestSeq: number): boolean {
  return requestSeq !== latestSeq;
}

/** Distance (meters, rounded) from a point to a manually-picked metro station. */
export function computeManualMetroDistanceM(point: GeoPoint, station: GeoPoint): number {
  return Math.round(haversineMeters(point.lat, point.lng, station.lat, station.lng));
}

/** Effective (shown) district: manual override wins, else the auto-detected value. */
export function computeEffectiveDistrictId(
  state: Pick<GeoOverrideState, "districtManualId" | "districtAutoId">,
): string | null {
  return state.districtManualId ?? state.districtAutoId;
}

/** Effective (shown) metro station id: manual override wins, else the auto-detected value. */
export function computeEffectiveMetroId(
  state: Pick<GeoOverrideState, "metroManualId" | "metroAutoId">,
): string | null {
  return state.metroManualId ?? state.metroAutoId;
}

/** Effective (shown) metro distance — paired with whichever metro id is effective above. */
export function computeEffectiveMetroDistanceM(
  state: Pick<GeoOverrideState, "metroManualId" | "metroManualDistanceM" | "metroAutoDistanceM">,
): number | null {
  return state.metroManualId ? state.metroManualDistanceM : state.metroAutoDistanceM;
}

/**
 * ROUTE_MAP_WITHOUT_VALID_COORDINATES guard.
 *
 * Defines what counts as a real, stored, valid RouteStop coordinate — used
 * to decide whether the public Route map/polyline is safe to render at all.
 * Deliberately does NOT count anything resolved client-side (e.g. the
 * geocode-on-render fallback in RouteMapHero) — only server-stored lat/lng
 * count, so this guard is meaningful even before any coordinate backfill.
 */

export interface RoutePointCandidate {
  lat?: number | null;
  lng?: number | null;
}

/** (0, 0) — "null island" — is a well-known technical default/sentinel, never a real venue. */
function isTechnicalDefaultCoordinate(lat: number, lng: number): boolean {
  return lat === 0 && lng === 0;
}

function isValidLatLng(lat: number | null | undefined, lng: number | null | undefined): lat is number {
  if (lat == null || lng == null) return false;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (isTechnicalDefaultCoordinate(lat, lng as number)) return false;
  return true;
}

/**
 * Counts distinct, valid, stored coordinate points. Duplicate coordinates
 * (two stops at the exact same point) count once — a "route" through the
 * same point twice isn't a second distinct point.
 */
export function countValidRoutePoints(stops: readonly RoutePointCandidate[]): number {
  const seen = new Set<string>();
  for (const s of stops) {
    if (!isValidLatLng(s.lat, s.lng)) continue;
    const key = `${(s.lat as number).toFixed(6)},${(s.lng as number).toFixed(6)}`;
    seen.add(key);
  }
  return seen.size;
}

/** The map/polyline must never render below this threshold. */
export function hasEnoughValidRoutePoints(stops: readonly RoutePointCandidate[]): boolean {
  return countValidRoutePoints(stops) >= 2;
}

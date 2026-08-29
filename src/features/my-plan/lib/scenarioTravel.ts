export type ScenarioCoordinates = { lat: number; lng: number };

/** Assumed average urban travel speed (km/h) used only to turn a real
 * straight-line distance into a rough duration estimate — there is no
 * routing engine in this codebase. Deliberately conservative (accounts for
 * traffic/parking, not a highway speed) so the estimate skews toward "leave
 * more time" rather than understating it. */
const ASSUMED_SPEED_KMH = 24;
const MIN_TRAVEL_MINUTES = 5;

function haversineKm(a: ScenarioCoordinates, b: ScenarioCoordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough estimated travel time between two points, rounded to the nearest 5
 * minutes — an approximation clearly labelled as such in the UI, not a real
 * routing result. */
export function estimateTravelMinutes(from: ScenarioCoordinates, to: ScenarioCoordinates): number {
  const km = haversineKm(from, to);
  const minutes = (km / ASSUMED_SPEED_KMH) * 60;
  return Math.max(MIN_TRAVEL_MINUTES, Math.round(minutes / 5) * 5);
}

export type ScenarioGap = {
  /** Estimated travel time between the two points, only when both have
   * known coordinates — otherwise null (never fabricated). */
  travelMinutes: number | null;
  /** Free minutes left after the estimated travel time, only computable
   * when both timestamps and a real travel estimate are available. */
  bufferMinutes: number | null;
  /** True when the buffer is thin enough to flag visually. */
  tight: boolean;
};

const TIGHT_BUFFER_MINUTES = 15;

export function computeScenarioGap(input: {
  previousEndsAt: Date | null;
  nextStartsAt: Date | null;
  previousCoords: ScenarioCoordinates | null;
  nextCoords: ScenarioCoordinates | null;
}): ScenarioGap {
  const travelMinutes =
    input.previousCoords && input.nextCoords
      ? estimateTravelMinutes(input.previousCoords, input.nextCoords)
      : null;

  let bufferMinutes: number | null = null;
  if (travelMinutes != null && input.previousEndsAt && input.nextStartsAt) {
    const totalGapMinutes = Math.round(
      (input.nextStartsAt.getTime() - input.previousEndsAt.getTime()) / 60_000,
    );
    bufferMinutes = totalGapMinutes - travelMinutes;
  }

  return {
    travelMinutes,
    bufferMinutes,
    tight: bufferMinutes != null && bufferMinutes < TIGHT_BUFFER_MINUTES,
  };
}

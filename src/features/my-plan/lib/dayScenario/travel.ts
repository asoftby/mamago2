import { haversineMeters } from "@/lib/geo/haversineMeters";
import type { GeoPoint, TravelLeg, TravelMode } from "./types";

/** Per-mode rules. Walk limits are hard; car/transit are soft preferences with penalties. */
export const MODE_RULES = {
  walk: {
    speedKmh: 4.8, // 1.2 km in 15 min
    hardMaxLegMin: 15,
    hardMaxDayMeters: 3000,
    hardMaxDayMetersToddler: 2000,
    exactCoordinatesOnly: true,
    overheadMin: 0,
  },
  car: {
    speedKmh: 24, // existing conservative urban estimate (scenarioTravel.ts)
    preferredLegMin: 25,
    farLegMin: 40,
    maxCell5Transitions: 1,
    penaltyPerMinuteOverPreferred: 1.2,
    penaltyPerTravelMinute: 0.15,
    penaltyCell5Transition: 8,
    overheadMin: 0,
  },
  transit: {
    speedKmh: 16,
    preferredLegMin: 30,
    farLegMin: 45,
    maxCell5Transitions: 2,
    penaltyPerMinuteOverPreferred: 0.9,
    penaltyPerTravelMinute: 0.12,
    penaltyCell5Transition: 5,
    overheadMin: 5, // wait for the vehicle
  },
} as const;

const MIN_LEG_MINUTES = 3;

export function travelLeg(from: GeoPoint, to: GeoPoint, mode: TravelMode): TravelLeg {
  const distanceM = Math.round(haversineMeters(from.lat, from.lng, to.lat, to.lng));
  const rules = MODE_RULES[mode];
  const minutes = Math.max(
    MIN_LEG_MINUTES,
    Math.ceil((distanceM / 1000 / rules.speedKmh) * 60 + rules.overheadMin),
  );
  return { mode, minutes, distanceM };
}

/**
 * In-memory TravelEstimate: memoises pair legs for the lifetime of one cached pool.
 * Haversine is cheaper than any lookup, so this is purely to avoid repeating the
 * math across the many candidate evaluations of one build; the key shape
 * (from, to, mode) matches what a persistent table would use later.
 */
export class TravelEstimator {
  private readonly memo = new Map<string, TravelLeg>();
  private computed = 0;

  estimate(fromId: string, from: GeoPoint, toId: string, to: GeoPoint, mode: TravelMode): TravelLeg {
    const key = `${fromId}>${toId}>${mode}`;
    const hit = this.memo.get(key);
    if (hit) return hit;
    const leg = travelLeg(from, to, mode);
    this.memo.set(key, leg);
    this.computed += 1;
    return leg;
  }

  stats(): { entries: number; computed: number } {
    return { entries: this.memo.size, computed: this.computed };
  }
}

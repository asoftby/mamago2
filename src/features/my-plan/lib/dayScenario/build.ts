import { haversineMeters } from "@/lib/geo/haversineMeters";
import { geoCellWithNeighbors } from "@/lib/geo/geoCell";
import { MODE_RULES, TravelEstimator } from "./travel";
import type {
  BuildInput,
  BuildResult,
  PoolEvent,
  ScenarioItem,
  TravelLeg,
  TravelMode,
} from "./types";

/** Minimum free minutes between the end of one item and the travel to the next. */
export const BUFFER_MIN = 10;
const MIN_MS = 60_000;
/** How far (0-100 utility points) a non-zero variant may shuffle quality. */
const VARIANT_JITTER = 25;
/** Anchor choice: utility bonus per mode-compatible companion near a candidate (max 3). */
const ANCHOR_COMPANION_BONUS = { walk: 15, car: 3, transit: 5 } as const;
const ANCHOR_MAX_COMPANIONS = 3;
/** Walk "no returns" tolerance: a leg may end at most this much closer to the start. */
const WALK_BACKTRACK_TOLERANCE_M = 250;

export type BuildDeps = {
  /** Audience-specific ranking score of one event (engagement + interests + experience). */
  scoreOf: (event: PoolEvent) => number;
  estimator: TravelEstimator;
};

type Placed = { event: PoolEvent; startMs: number; endMs: number; pinned: boolean };

function hash01(seed: number, id: string): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function ageEligible(event: PoolEvent, ageRanges: string[]): boolean {
  if (ageRanges.length === 0) return true;
  if (event.adultOnly && ageRanges.some((range) => range !== "18+")) return false;
  return event.ageTags.length === 0 || event.ageTags.some((tag) => ageRanges.includes(tag));
}

type ChainEval = { ok: boolean; penalty: number; legs: (TravelLeg | null)[] };

function evaluateChain(
  chain: Placed[],
  mode: TravelMode,
  hasToddler: boolean,
  estimator: TravelEstimator,
): ChainEval {
  const legs: (TravelLeg | null)[] = [null];
  let penalty = 0;
  let totalMeters = 0;
  let cell5Transitions = 0;
  const start = chain[0]?.event.geo ?? null;
  let prevRadius = 0;

  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1]!;
    const b = chain[i]!;
    const ga = a.event.geo;
    const gb = b.event.geo;
    if (!ga || !gb) {
      legs.push(null);
      continue;
    }
    const leg = estimator.estimate(a.event.activityId, ga, b.event.activityId, gb, mode);
    legs.push(leg);
    totalMeters += leg.distanceM;
    // The gap on the clock must fit the travel plus a buffer, in every mode.
    if (b.startMs - a.endMs < (leg.minutes + BUFFER_MIN) * MIN_MS) return { ok: false, penalty, legs };

    if (mode === "walk") {
      const rules = MODE_RULES.walk;
      if (leg.minutes > rules.hardMaxLegMin) return { ok: false, penalty, legs };
      if (!geoCellWithNeighbors(ga.geoCell6).includes(gb.geoCell6)) return { ok: false, penalty, legs };
      if (start) {
        const radius = haversineMeters(start.lat, start.lng, gb.lat, gb.lng);
        if (radius < prevRadius - WALK_BACKTRACK_TOLERANCE_M) return { ok: false, penalty, legs };
        prevRadius = Math.max(prevRadius, radius);
      }
      penalty += leg.distanceM / 100;
    } else {
      const rules = MODE_RULES[mode];
      penalty += Math.max(0, leg.minutes - rules.preferredLegMin) * rules.penaltyPerMinuteOverPreferred;
      penalty += leg.minutes * rules.penaltyPerTravelMinute;
      if (ga.geoCell5 !== gb.geoCell5) {
        cell5Transitions += 1;
        penalty += rules.penaltyCell5Transition;
        if (!geoCellWithNeighbors(ga.geoCell5).includes(gb.geoCell5)) {
          penalty += rules.penaltyCell5Transition;
        }
      }
    }
  }

  if (mode === "walk") {
    const cap = hasToddler ? MODE_RULES.walk.hardMaxDayMetersToddler : MODE_RULES.walk.hardMaxDayMeters;
    if (totalMeters > cap) return { ok: false, penalty, legs };
  } else if (cell5Transitions > MODE_RULES[mode].maxCell5Transitions) {
    return { ok: false, penalty, legs };
  }
  return { ok: true, penalty, legs };
}

function modeAllows(event: PoolEvent, mode: TravelMode): boolean {
  if (!event.geo) return false;
  if (mode === "walk") return !event.geo.approximate;
  return true;
}

/**
 * Greedy day builder. Pinned items are the anchors; otherwise the best-scored
 * candidate becomes the anchor by taking the first slot. Each further pick maximises
 * normalised score + variant jitter - travel penalty of the resulting chain, subject
 * to the mode's hard rules and to free time on the clock. Pure: no I/O, no clock.
 */
export function buildDayScenario(events: PoolEvent[], input: BuildInput, deps: BuildDeps): BuildResult {
  const { mode, audience } = input;
  const excluded = new Set(input.excludeActivityIds);
  const byId = new Map(events.map((event) => [event.activityId, event]));

  const placed: Placed[] = [];
  for (const pin of input.pinned) {
    const event = byId.get(pin.activityId);
    if (!event) continue;
    placed.push({ event, startMs: pin.startsAtMs, endMs: pin.startsAtMs + event.durationMin * MIN_MS, pinned: true });
  }
  const placedIds = new Set(placed.map((p) => p.event.activityId));

  const eligible = events.filter(
    (event) =>
      !placedIds.has(event.activityId) &&
      !excluded.has(event.activityId) &&
      ageEligible(event, audience.ageRanges) &&
      modeAllows(event, mode),
  );

  const raw = eligible.map((event) => deps.scoreOf(event));
  // Ratio-to-best on a zero-based scale: small score differences stay small (no
  // min-max stretching of noise); negative scores sit below the zero line.
  const floor = raw.length ? Math.min(0, ...raw) : 0;
  const hi = raw.length ? Math.max(...raw) : 0;
  const utility = new Map<string, number>();
  eligible.forEach((event, i) => {
    const norm = hi > floor ? ((raw[i]! - floor) / (hi - floor)) * 100 : 50;
    const jitter = input.variant > 0 ? hash01(input.variant, event.activityId) * VARIANT_JITTER : 0;
    utility.set(event.activityId, norm + jitter);
  });

  // Pool indexed by cell: how many other eligible events share the walking ring
  // (walk) or the coarse cell (car/transit). Used only to choose the anchor.
  const byCell6 = new Map<string, number>();
  const byCell5 = new Map<string, number>();
  for (const event of eligible) {
    if (!event.geo) continue;
    byCell6.set(event.geo.geoCell6, (byCell6.get(event.geo.geoCell6) ?? 0) + 1);
    byCell5.set(event.geo.geoCell5, (byCell5.get(event.geo.geoCell5) ?? 0) + 1);
  }
  const companions = (event: PoolEvent): number => {
    if (!event.geo) return 0;
    const count =
      mode === "walk"
        ? geoCellWithNeighbors(event.geo.geoCell6).reduce((sum, cell) => sum + (byCell6.get(cell) ?? 0), 0) - 1
        : (byCell5.get(event.geo.geoCell5) ?? 0) - 1;
    return Math.min(ANCHOR_MAX_COMPANIONS, Math.max(0, count));
  };

  const overlapsBusy = (startMs: number, endMs: number) =>
    input.busy.some((b) => startMs < b.endMs + BUFFER_MIN * MIN_MS && endMs + BUFFER_MIN * MIN_MS > b.startMs);

  const sortChain = (chain: Placed[]) => [...chain].sort((a, b) => a.startMs - b.startMs);
  let current = evaluateChain(sortChain(placed), mode, audience.hasToddler, deps.estimator);

  while (placed.length < input.targetCount) {
    let best: { placed: Placed; gain: number; chain: ChainEval } | null = null;
    for (const event of eligible) {
      if (placedIds.has(event.activityId)) continue;
      for (const startMs of event.sessionStartsMs) {
        const endMs = startMs + event.durationMin * MIN_MS;
        if (startMs < input.windowStartMs || endMs > input.windowEndMs) continue;
        if (overlapsBusy(startMs, endMs)) continue;
        const candidate: Placed = { event, startMs, endMs, pinned: false };
        const chain = sortChain([...placed, candidate]);
        if (chain.some((p, i) => i > 0 && p.startMs < chain[i - 1]!.endMs + BUFFER_MIN * MIN_MS)) continue;
        const evaluated = evaluateChain(chain, mode, audience.hasToddler, deps.estimator);
        if (!evaluated.ok) continue;
        const anchorBonus = placed.length === 0 ? companions(event) * ANCHOR_COMPANION_BONUS[mode] : 0;
        const gain = (utility.get(event.activityId) ?? 0) + anchorBonus - (evaluated.penalty - current.penalty);
        if (!best || gain > best.gain || (gain === best.gain && startMs < best.placed.startMs)) {
          best = { placed: candidate, gain, chain: evaluated };
        }
      }
    }
    if (!best) break;
    placed.push(best.placed);
    placedIds.add(best.placed.event.activityId);
    current = evaluateChain(sortChain(placed), mode, audience.hasToddler, deps.estimator);
  }

  const chain = sortChain(placed);
  const evaluated = evaluateChain(chain, mode, audience.hasToddler, deps.estimator);
  const farLimit = mode === "walk" ? Infinity : MODE_RULES[mode].farLegMin;
  const items: ScenarioItem[] = chain.map((p, i) => ({
    activityId: p.event.activityId,
    card: p.event.card,
    startsAtMs: p.startMs,
    endsAtMs: p.endMs,
    pinned: p.pinned,
    travelFromPrev: evaluated.legs[i] ?? null,
    approximatePlace: p.event.geo?.approximate ?? false,
    far: (evaluated.legs[i]?.minutes ?? 0) > farLimit,
    score: Math.round((utility.get(p.event.activityId) ?? 0) * 10) / 10,
  }));

  let status: BuildResult["status"] = "ok";
  let suggestMode: TravelMode | null = null;
  if (items.length === 0) {
    status = "empty";
  }
  if (mode === "walk" && items.length < input.targetCount) {
    const otherModeCandidates = events.some(
      (event) =>
        !placedIds.has(event.activityId) &&
        !excluded.has(event.activityId) &&
        ageEligible(event, audience.ageRanges) &&
        modeAllows(event, "car"),
    );
    if (otherModeCandidates) {
      status = "few_nearby";
      suggestMode = "car";
    }
  }
  return { status, items, mode, suggestMode, candidateCount: eligible.length };
}

/** "Заменить": keep the other items as anchors and pick one new item for the freed slot. */
export function replaceScenarioItem(
  events: PoolEvent[],
  input: BuildInput,
  current: { activityId: string; startsAtMs: number }[],
  replaceActivityId: string,
  deps: BuildDeps,
): BuildResult {
  const kept = current.filter((item) => item.activityId !== replaceActivityId);
  return buildDayScenario(
    events,
    {
      ...input,
      pinned: kept,
      excludeActivityIds: [...input.excludeActivityIds, replaceActivityId],
      targetCount: kept.length + 1,
      variant: input.variant + 1,
    },
    deps,
  );
}


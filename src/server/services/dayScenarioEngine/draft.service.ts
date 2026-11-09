import { z } from "zod";
import { calendarDaySchema } from "@/lib/decision/planRequestSchemas";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { activePlanScopeFor } from "@/server/family/familyAccess";
import { buildSelectedProfileContext } from "@/lib/decision/subjects";
import { CanonicalAgeRangeSchema } from "@/lib/decision/decisionContext";
import { CANONICAL_EVENT_INTEREST_SLUGS } from "@/lib/event/eventSystemInterests";
import { planSuggestionScore, zonedDayRange } from "@/server/services/planSuggestions.service";
import { buildAnotherVariant, buildDayScenario, listReplacementAlternatives, replaceScenarioItem } from "@/features/my-plan/lib/dayScenario/build";
import type {
  BuildInput,
  BuildResult,
  BusyInterval,
  PoolEvent,
  TravelMode,
} from "@/features/my-plan/lib/dayScenario/types";
import { DEFAULT_EVENT_DURATION_MIN } from "./poolMapping";
import { getDayScenarioPool } from "./pool";

const MINUTE_MS = 60_000;
/** Default planning window (local time) when the request does not narrow it. */
const DEFAULT_DAY_START = "09:00";
const DEFAULT_DAY_END = "20:00";
const MIN_WINDOW_MINUTES = 60;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export function minutesOfDay(value: string): number {
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
/** Do not schedule something that starts in the next half hour. */
const LEAD_TIME_MS = 30 * 60_000;
const TODDLER_RANGES = new Set(["0-1", "1-3"]);

export const draftRequestSchema = z.object({
  city: z.string().min(1).max(64).optional().default("minsk"),
  date: calendarDaySchema,
  action: z.enum(["build", "rebuild", "replace", "alternatives", "another"]).default("build"),
  /** The UI exposes walk/car; transit stays in the model but is not offered yet. */
  mode: z.enum(["walk", "car", "transit"]).optional().default("car"),
  ageRanges: z.array(CanonicalAgeRangeSchema).max(12).optional().default([]),
  personaIds: z.array(z.string().min(1).max(64)).max(12).optional().default([]),
  excludeActivityIds: z.array(z.string().min(1).max(64)).max(100).optional().default([]),
  /** "another": every point of this day the user has already seen; seen filler places are not offered again. */
  shownActivityIds: z.array(z.string().min(1).max(64)).max(100).optional().default([]),
  /** Current draft; items listed in `pinnedActivityIds` are kept by "rebuild". */
  current: z
    .array(z.object({ activityId: z.string().min(1).max(64), startsAt: z.string().datetime() }))
    .max(8)
    .optional()
    .default([]),
  pinnedActivityIds: z.array(z.string().min(1).max(64)).max(8).optional().default([]),
  replaceActivityId: z.string().min(1).max(64).optional(),
  variant: z.number().int().min(0).max(1000).optional().default(0),
  /**
   * «Изменить день»: the entries a saved scenario created on this day are the draft itself, so they are neither busy time
   * nor "already planned" (otherwise the day would be rebuilt around, and without, its own points).
   */
  editScenario: z.boolean().optional().default(false),
  targetCount: z.number().int().min(1).max(4).optional().default(3),
  /** Planning window inside the day, local "HH:MM" (default 09:00-20:00), e.g. 16:00-20:00 on a weekday. */
  dayStart: hhmm.optional().default(DEFAULT_DAY_START),
  dayEnd: hhmm.optional().default(DEFAULT_DAY_END),
}).refine((value) => minutesOfDay(value.dayEnd) - minutesOfDay(value.dayStart) >= MIN_WINDOW_MINUTES, {
  message: "dayEnd must be at least 60 minutes after dayStart",
  path: ["dayEnd"],
});
export type DraftRequest = z.infer<typeof draftRequestSchema>;

export type DraftItem = {
  kind: "event" | "place";
  /** Filler place without a hours record: show "уточните часы работы". */
  hoursUnconfirmed: boolean;
  /** Event time comes from the schedule rules (no ActivitySession): show "время по расписанию — уточните у организатора". */
  scheduleUnconfirmed: boolean;
  activityId: string;
  card: PoolEvent["card"];
  startsAt: string;
  endsAt: string;
  pinned: boolean;
  travel: { mode: TravelMode; minutes: number; distanceM: number } | null;
  approximatePlace: boolean;
  far: boolean;
};

export type DraftResponse = {
  status: BuildResult["status"];
  mode: TravelMode;
  suggestMode: TravelMode | null;
  variant: number;
  items: DraftItem[];
  /**
   * action "alternatives" only: up to 3 whole-day variants, each with `replaceActivityId`
   * swapped for a different point (the point not in the current draft is the alternative).
   * `items` is empty for that action; every other action returns [].
   */
  alternatives: DraftItem[][];
  /** action "another" only: no new variant exists ("Мы показали всё, что подходит"); `items` is empty. */
  exhausted: boolean;
  /**
   * action "rebuild": pinned points the pool does not hold (an event whose last session already started, a place that
   * closed): the draft cannot show them, but they are still the user's saved points. The client keeps them in a save.
   */
  unpooledPinnedIds: string[];
  meta: { poolCache: "hit" | "miss"; poolSize: number; poolPlaces: number; poolVirtual: number; staleGeoCells: number; candidateCount: number; buildMs: number };
};

/** How many replacement variants one "alternatives" call tries before giving up. */
const MAX_ALTERNATIVE_TRIES = 8;
const ALTERNATIVES_SHOWN = 3;

function toDraftItems(result: BuildResult): DraftItem[] {
  return toDraftItemsFrom(result.items);
}

function toDraftItemsFrom(items: BuildResult["items"]): DraftItem[] {
  return items.map((item) => ({
    kind: item.kind,
    hoursUnconfirmed: item.hoursUnconfirmed,
    scheduleUnconfirmed: item.scheduleUnconfirmed,
    activityId: item.activityId,
    card: item.card,
    startsAt: new Date(item.startsAtMs).toISOString(),
    endsAt: new Date(item.endsAtMs).toISOString(),
    pinned: item.pinned,
    travel: item.travelFromPrev,
    approximatePlace: item.approximatePlace,
    far: item.far,
  }));
}

async function loadUserContext(userId: string, date: string, personaIds: string[], editScenario = false) {
  // Editing: only THIS user's saved scenario of the day stops being busy time / "already planned". Other visible
  // scenarios (a family member's) and every other entry stay. AND keeps the family scope's own OR intact.
  const editedScenario = editScenario ? await prisma.dayScenario.findUnique({ where: { userId_date: { userId, date } }, select: { id: true } }) : null;
  const [plan, profile] = await Promise.all([
    prisma.planItem.findMany({
      where: {
        AND: [
          await activePlanScopeFor(userId),
          { date },
          ...(editedScenario ? [{ OR: [{ scenarioId: null }, { scenarioId: { not: editedScenario.id } }] }] : []),
        ],
      },
      select: { activityId: true, placeId: true, startsAt: true, endsAt: true },
    }),
    personaIds.length > 0
      ? buildSelectedProfileContext({ userId, personaIds, targetDate: date })
      : Promise.resolve({ subjects: [], systemInterestSlugs: [] as string[] }),
  ]);
  const busy: BusyInterval[] = [];
  const planned: string[] = [];
  for (const item of plan) {
    if (item.activityId) planned.push(item.activityId);
    // A place already in the plan that day is not offered again as a filler.
    if (item.placeId) planned.push(item.placeId);
    if (item.startsAt) {
      const end = item.endsAt ?? new Date(item.startsAt.getTime() + DEFAULT_EVENT_DURATION_MIN * 60_000);
      busy.push({ startMs: item.startsAt.getTime(), endMs: end.getTime() });
    }
  }
  const childRanges = profile.subjects
    .map((subject) => (subject.kind === "child" ? subject.ageRange : undefined))
    .filter((range): range is string => Boolean(range));
  return { busy, planned, childRanges, interests: profile.systemInterestSlugs };
}

/**
 * One draft computation. The only database work is the cached pool read and, for a
 * signed-in user, their own plan entries and selected profiles (never cached).
 */
export async function runDayScenarioDraft(
  request: DraftRequest,
  user: { id: string } | null,
  nowMs: number = Date.now(),
): Promise<DraftResponse> {
  const started = performance.now();
  const { value: pool, hit } = await getDayScenarioPool(request.city, request.date);

  const ctx = user
    ? await loadUserContext(user.id, request.date, request.personaIds, request.editScenario)
    : { busy: [], planned: [], childRanges: [] as string[], interests: [] as string[] };

  const ageRanges = [...new Set([...request.ageRanges, ...ctx.childRanges])];
  const profileInterestSlugs = ctx.interests.filter((slug) => CANONICAL_EVENT_INTEREST_SLUGS.has(slug));
  const day = zonedDayRange(request.date, DEFAULT_TZ);
  const windowStartMs = Math.max(day.start.getTime() + minutesOfDay(request.dayStart) * MINUTE_MS, nowMs + LEAD_TIME_MS);

  const input: BuildInput = {
    windowStartMs,
    windowEndMs: day.start.getTime() + minutesOfDay(request.dayEnd) * MINUTE_MS,
    mode: request.mode,
    audience: { ageRanges, profileInterestSlugs, hasToddler: ageRanges.some((range) => TODDLER_RANGES.has(range)) },
    busy: ctx.busy,
    excludeActivityIds: [...new Set([...request.excludeActivityIds, ...ctx.planned])],
    pinned: [],
    targetCount: request.targetCount,
    variant: request.variant,
  };
  const deps = {
    estimator: pool.estimator,
    scoreOf: (event: PoolEvent) =>
      planSuggestionScore({
        engagementScore: event.engagementScore,
        profileInterestSlugs,
        scheduleJson: event.scheduleJson,
        categoryId: event.categoryId,
        discoverySignalIds: event.discoverySignalIds,
        format: event.format,
      }).score,
  };

  const current = request.current.map((item) => ({
    activityId: item.activityId,
    startsAtMs: Date.parse(item.startsAt),
  }));
  let result: BuildResult;
  let alternatives: DraftItem[][] = [];
  let exhausted = false;
  let variant = request.variant;
  if (request.action === "alternatives" && request.replaceActivityId) {
    // Every variant is a pure in-memory build on the already cached pool (microseconds), so the
    // whole sheet is one request instead of three.
    alternatives = listReplacementAlternatives(pool.events, input, current, request.replaceActivityId, deps, {
      maxTries: MAX_ALTERNATIVE_TRIES,
      limit: ALTERNATIVES_SHOWN,
    }).map(toDraftItemsFrom);
    result = { status: alternatives.length > 0 ? "ok" : "empty", items: [], mode: input.mode, suggestMode: null, candidateCount: alternatives.length };
  } else if (request.action === "another") {
    const another = buildAnotherVariant(pool.events, input, current, new Set(request.shownActivityIds), deps);
    exhausted = another.exhausted;
    variant = another.variant;
    result = exhausted ? { ...another.result, items: [] } : another.result;
  } else if (request.action === "replace" && request.replaceActivityId) {
    result = replaceScenarioItem(pool.events, input, current, request.replaceActivityId, deps);
  } else if (request.action === "rebuild") {
    const keep = new Set(request.pinnedActivityIds);
    result = buildDayScenario(pool.events, { ...input, pinned: current.filter((c) => keep.has(c.activityId)) }, deps);
  } else {
    result = buildDayScenario(pool.events, input, deps);
  }

  const pooled = new Set(pool.events.map((event) => event.activityId));
  const unpooledPinnedIds = request.action === "rebuild" ? request.pinnedActivityIds.filter((id) => !pooled.has(id)) : [];
  return {
    status: result.status,
    mode: result.mode,
    suggestMode: result.suggestMode,
    variant,
    items: toDraftItems(result),
    alternatives,
    exhausted,
    unpooledPinnedIds,
    meta: {
      poolCache: hit ? "hit" : "miss",
      poolSize: pool.events.length,
      poolPlaces: pool.placeCount,
      poolVirtual: pool.virtualCount,
      staleGeoCells: pool.staleGeoCells,
      candidateCount: result.candidateCount,
      buildMs: Math.round((performance.now() - started) * 10) / 10,
    },
  };
}

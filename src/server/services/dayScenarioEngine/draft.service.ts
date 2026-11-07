import { z } from "zod";
import { calendarDaySchema } from "@/lib/decision/planRequestSchemas";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { activePlanScopeFor } from "@/server/family/familyAccess";
import { buildSelectedProfileContext } from "@/lib/decision/subjects";
import { CanonicalAgeRangeSchema } from "@/lib/decision/decisionContext";
import { CANONICAL_EVENT_INTEREST_SLUGS } from "@/lib/event/eventSystemInterests";
import { planSuggestionScore, zonedDayRange } from "@/server/services/planSuggestions.service";
import { buildDayScenario, replaceScenarioItem } from "@/features/my-plan/lib/dayScenario/build";
import type {
  BuildInput,
  BuildResult,
  BusyInterval,
  PoolEvent,
  TravelMode,
} from "@/features/my-plan/lib/dayScenario/types";
import { DEFAULT_EVENT_DURATION_MIN } from "./poolMapping";
import { getDayScenarioPool } from "./pool";

const HOUR_MS = 3_600_000;
const DAY_PLAN_START_HOUR = 9;
const DAY_PLAN_END_HOUR = 20;
/** Do not schedule something that starts in the next half hour. */
const LEAD_TIME_MS = 30 * 60_000;
const TODDLER_RANGES = new Set(["0-1", "1-3"]);

export const draftRequestSchema = z.object({
  city: z.string().min(1).max(64).optional().default("minsk"),
  date: calendarDaySchema,
  action: z.enum(["build", "rebuild", "replace"]).default("build"),
  /** The UI exposes walk/car; transit stays in the model but is not offered yet. */
  mode: z.enum(["walk", "car", "transit"]).optional().default("car"),
  ageRanges: z.array(CanonicalAgeRangeSchema).max(12).optional().default([]),
  personaIds: z.array(z.string().min(1).max(64)).max(12).optional().default([]),
  excludeActivityIds: z.array(z.string().min(1).max(64)).max(100).optional().default([]),
  /** Current draft; items listed in `pinnedActivityIds` are kept by "rebuild". */
  current: z
    .array(z.object({ activityId: z.string().min(1).max(64), startsAt: z.string().datetime() }))
    .max(8)
    .optional()
    .default([]),
  pinnedActivityIds: z.array(z.string().min(1).max(64)).max(8).optional().default([]),
  replaceActivityId: z.string().min(1).max(64).optional(),
  variant: z.number().int().min(0).max(1000).optional().default(0),
  targetCount: z.number().int().min(1).max(4).optional().default(3),
});
export type DraftRequest = z.infer<typeof draftRequestSchema>;

export type DraftResponse = {
  status: BuildResult["status"];
  mode: TravelMode;
  suggestMode: TravelMode | null;
  variant: number;
  items: {
    activityId: string;
    card: PoolEvent["card"];
    startsAt: string;
    endsAt: string;
    pinned: boolean;
    travel: { mode: TravelMode; minutes: number; distanceM: number } | null;
    approximatePlace: boolean;
    far: boolean;
  }[];
  meta: { poolCache: "hit" | "miss"; poolSize: number; candidateCount: number; buildMs: number };
};

async function loadUserContext(userId: string, date: string, personaIds: string[]) {
  const [plan, profile] = await Promise.all([
    prisma.planItem.findMany({
      where: { ...(await activePlanScopeFor(userId)), date },
      select: { activityId: true, startsAt: true, endsAt: true },
    }),
    personaIds.length > 0
      ? buildSelectedProfileContext({ userId, personaIds, targetDate: date })
      : Promise.resolve({ subjects: [], systemInterestSlugs: [] as string[] }),
  ]);
  const busy: BusyInterval[] = [];
  const planned: string[] = [];
  for (const item of plan) {
    if (item.activityId) planned.push(item.activityId);
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
    ? await loadUserContext(user.id, request.date, request.personaIds)
    : { busy: [], planned: [], childRanges: [] as string[], interests: [] as string[] };

  const ageRanges = [...new Set([...request.ageRanges, ...ctx.childRanges])];
  const profileInterestSlugs = ctx.interests.filter((slug) => CANONICAL_EVENT_INTEREST_SLUGS.has(slug));
  const day = zonedDayRange(request.date, DEFAULT_TZ);
  const windowStartMs = Math.max(day.start.getTime() + DAY_PLAN_START_HOUR * HOUR_MS, nowMs + LEAD_TIME_MS);

  const input: BuildInput = {
    windowStartMs,
    windowEndMs: day.start.getTime() + DAY_PLAN_END_HOUR * HOUR_MS,
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
  if (request.action === "replace" && request.replaceActivityId) {
    result = replaceScenarioItem(pool.events, input, current, request.replaceActivityId, deps);
  } else if (request.action === "rebuild") {
    const keep = new Set(request.pinnedActivityIds);
    result = buildDayScenario(pool.events, { ...input, pinned: current.filter((c) => keep.has(c.activityId)) }, deps);
  } else {
    result = buildDayScenario(pool.events, input, deps);
  }

  return {
    status: result.status,
    mode: result.mode,
    suggestMode: result.suggestMode,
    variant: request.variant,
    items: result.items.map((item) => ({
      activityId: item.activityId,
      card: item.card,
      startsAt: new Date(item.startsAtMs).toISOString(),
      endsAt: new Date(item.endsAtMs).toISOString(),
      pinned: item.pinned,
      travel: item.travelFromPrev,
      approximatePlace: item.approximatePlace,
      far: item.far,
    })),
    meta: {
      poolCache: hit ? "hit" : "miss",
      poolSize: pool.events.length,
      candidateCount: result.candidateCount,
      buildMs: Math.round((performance.now() - started) * 10) / 10,
    },
  };
}

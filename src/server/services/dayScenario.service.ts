import { createHash } from "node:crypto";
import { Prisma, type DayScenario, type DayScenarioItemOverride } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDaysLocal, getLocalDateKey } from "@/lib/date/localDateKey";

export type FingerprintSource = {
  id: string;
  activityId?: string | null;
  routeId?: string | null;
  placeId?: string | null;
  articleId?: string | null;
  date?: string;
  startsAt: Date | null;
};

const scenarioActivitySelect = {
  id: true,
  slug: true,
  title: true,
  type: true,
  coverImageUrl: true,
  ageLabel: true,
  scheduleMode: true,
  schedulingKind: true,
  scheduleJson: true,
  place: {
    select: {
      shortAddress: true,
      formattedAddr: true,
      customAddress: true,
      city: { select: { name: true } },
      metroAuto: { select: { name: true } },
      metroManual: { select: { name: true } },
    },
  },
  venue: {
    select: {
      addressLine: true,
      kind: true,
      place: {
        select: {
          shortAddress: true,
          formattedAddr: true,
          customAddress: true,
          city: { select: { name: true } },
          metroAuto: { select: { name: true } },
          metroManual: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.ActivitySelect;

export type ScenarioPlanItem = {
  id: string;
  userId: string;
  activityId: string | null;
  date: string;
  startsAt: Date | null;
  title: string | null;
  coverImageUrl: string | null;
  createdAt: Date;
  activity:
    | (Prisma.ActivityGetPayload<{ select: typeof scenarioActivitySelect }> & {
        /** Sessions falling on this PlanItem's date — a generous DB window,
         * precisely filtered by `getLocalDateKey` below. */
        sessions: { id: string; startsAt: Date }[];
      })
    | null;
};

/**
 * Same PlanItem set as `listPlanItemsByDate`, but the activity projection
 * additionally carries `scheduleMode` + same-date `ActivitySession`s — needed
 * to recover a genuinely unambiguous authoritative start time for items
 * whose `PlanItem.startsAt` is null only because the add-flow didn't resolve
 * a session (not because the source has no fixed time). See
 * `resolveScenarioItemTime` in `src/features/my-plan/lib/scenarioProjection.ts`.
 * Scenario-only: intentionally does not select price/currency fields —
 * Scenario cards never show pricing (see Task 7 UX phase).
 */
export async function listPlanItemsByDateForScenario(
  userId: string,
  date: string,
): Promise<ScenarioPlanItem[]> {
  // Generous UTC-agnostic bound around the target local date; exact match is
  // done in-memory via getLocalDateKey below (never guesses across dates).
  const windowStart = new Date(`${addDaysLocal(date, -1)}T00:00:00.000Z`);
  const windowEnd = new Date(`${addDaysLocal(date, 2)}T00:00:00.000Z`);

  const items = await prisma.planItem.findMany({
    where: { userId, date },
    include: {
      activity: {
        select: {
          ...scenarioActivitySelect,
          sessions: {
            where: { startsAt: { gte: windowStart, lt: windowEnd } },
            select: { id: true, startsAt: true },
          },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return items.map((item) => ({
    ...item,
    activity: item.activity
      ? {
          ...item.activity,
          sessions: item.activity.sessions.filter(
            (session) => getLocalDateKey(session.startsAt) === date,
          ),
        }
      : null,
  })) as ScenarioPlanItem[];
}

/**
 * Batch-loads ActivitySession rows needed to recover an effective time for
 * PlanItems whose PlanItem.startsAt is null — one bounded query across
 * every (activityId, date) pair that actually needs it (callers should
 * already have filtered to startsAt == null items), grouped deterministically
 * by `${activityId}|${local date}` — the same recovery tier Scenario uses
 * (see `resolveScenarioItemTime`), so My Plan and Scenario never disagree
 * on whether a time is unambiguously recoverable. Items without an
 * activityId are skipped (nothing to recover from).
 */
export async function listActivitySessionsForPlanItems(
  items: { activityId: string | null; date: string }[],
): Promise<Map<string, Date[]>> {
  const pending = items.filter(
    (item): item is { activityId: string; date: string } => item.activityId != null,
  );
  if (pending.length === 0) return new Map();

  const dates = pending.map((item) => item.date);
  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));
  // Generous UTC-agnostic bound around the target local dates; exact
  // per-date matching is done in-memory via getLocalDateKey below (never
  // guesses across dates) — same technique as listPlanItemsByDateForScenario.
  const windowStart = new Date(`${addDaysLocal(minDate, -1)}T00:00:00.000Z`);
  const windowEnd = new Date(`${addDaysLocal(maxDate, 2)}T00:00:00.000Z`);

  const activityIds = [...new Set(pending.map((item) => item.activityId))];

  const sessions = await prisma.activitySession.findMany({
    where: { activityId: { in: activityIds }, startsAt: { gte: windowStart, lt: windowEnd } },
    select: { activityId: true, startsAt: true },
  });

  const grouped = new Map<string, Date[]>();
  for (const session of sessions) {
    const key = `${session.activityId}|${getLocalDateKey(session.startsAt)}`;
    const list = grouped.get(key) ?? [];
    list.push(session.startsAt);
    grouped.set(key, list);
  }
  return grouped;
}

/**
 * Cheap deterministic signature of a PlanItem set: detects added/removed
 * items and startsAt changes, order-independent. Not a general version
 * hash — just enough to answer "does My Plan still match what the
 * Scenario was built from".
 */
export function computePlanFingerprint(
  items: FingerprintSource[],
  overrides: ReadonlyMap<string, Date> = new Map(),
  acceptedConflictKeys: readonly string[] = [],
): string {
  const parts = items
    .map((item) => JSON.stringify({
      id: item.id,
      activityId: item.activityId ?? null,
      routeId: item.routeId ?? null,
      placeId: item.placeId ?? null,
      articleId: item.articleId ?? null,
      date: item.date ?? null,
      startsAt: item.startsAt?.toISOString() ?? null,
      overrideStartsAt: overrides.get(item.id)?.toISOString() ?? null,
    }))
    .sort();
  return createHash("sha256")
    .update(JSON.stringify({ items: parts, acceptedConflictKeys: [...acceptedConflictKeys].sort() }))
    .digest("hex")
    .slice(0, 32);
}

export function getDayScenario(userId: string, date: string): Promise<DayScenario | null> {
  return prisma.dayScenario.findUnique({ where: { userId_date: { userId, date } } });
}

/**
 * Idempotent get-or-create, scoped to the authenticated user. Never creates
 * a second row for the same user/date (DB-unique-constraint-enforced), and
 * never overwrites an already-existing Scenario's fingerprint — creation
 * only ever happens once per user/date.
 */
export async function ensureDayScenario(
  userId: string,
  date: string,
  items: FingerprintSource[],
): Promise<DayScenario> {
  const existing = await getDayScenario(userId, date);
  if (existing) return existing;

  try {
    return await prisma.dayScenario.create({
      data: { userId, date, planFingerprint: computePlanFingerprint(items) },
    });
  } catch (error) {
    // Race safety net: a concurrent duplicate request created it first.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const scenario = await getDayScenario(userId, date);
      if (scenario) return scenario;
    }
    throw error;
  }
}

/**
 * Recomputes the fingerprint from the current PlanItem set and stores it —
 * the "Обновить сценарий" action. No-op (returns null) if no Scenario
 * exists yet for this user/date.
 */
export async function refreshDayScenario(
  userId: string,
  date: string,
  items: FingerprintSource[],
): Promise<DayScenario | null> {
  const existing = await getDayScenario(userId, date);
  if (!existing) return null;

  const overrides = await listScenarioItemOverrides(existing.id);

  return prisma.dayScenario.update({
    where: { userId_date: { userId, date } },
    data: {
      planFingerprint: computePlanFingerprint(items, overrides, existing.acceptedConflictKeys),
    },
  });
}

/** planItemId -> assigned start time, for one Scenario. */
export async function listScenarioItemOverrides(
  scenarioId: string,
): Promise<Map<string, Date>> {
  const rows = await prisma.dayScenarioItemOverride.findMany({
    where: { scenarioId },
    select: { planItemId: true, startTimeOverride: true },
  });
  return new Map(rows.map((row) => [row.planItemId, row.startTimeOverride]));
}

/**
 * Same as `listScenarioItemOverrides` but bounded across multiple Scenarios
 * at once (one query) — used by My Plan, which shows items across every
 * date a user has a Scenario for, not just one. `planItemId` is globally
 * unique, so a flat map is safe even across scenarios/dates.
 */
export async function listScenarioItemOverridesForScenarios(
  scenarioIds: string[],
): Promise<Map<string, Date>> {
  if (scenarioIds.length === 0) return new Map();
  const rows = await prisma.dayScenarioItemOverride.findMany({
    where: { scenarioId: { in: scenarioIds } },
    select: { planItemId: true, startTimeOverride: true },
  });
  return new Map(rows.map((row) => [row.planItemId, row.startTimeOverride]));
}

/**
 * "Назначить время" for a genuinely flexible item. Ownership is enforced
 * structurally, not just checked: the Scenario is looked up by
 * `(userId, date)` (never a client-supplied Scenario id), and the PlanItem
 * must belong to that same `userId` and `date` — a foreign or wrong-date
 * `planItemId` can never be attached to another user's Scenario.
 */
export async function setScenarioItemOverride(
  userId: string,
  date: string,
  planItemId: string,
  startTimeOverride: Date,
): Promise<DayScenarioItemOverride> {
  const scenario = await getDayScenario(userId, date);
  if (!scenario) {
    throw new Error("SCENARIO_NOT_FOUND");
  }

  const planItem = await prisma.planItem.findFirst({
    where: { id: planItemId, userId, date },
    select: { id: true },
  });
  if (!planItem) {
    throw new Error("PLAN_ITEM_NOT_FOUND");
  }

  return prisma.dayScenarioItemOverride.upsert({
    where: { scenarioId_planItemId: { scenarioId: scenario.id, planItemId } },
    create: { scenarioId: scenario.id, planItemId, startTimeOverride },
    update: { startTimeOverride },
  });
}

/**
 * Defensive cleanup on refresh: drops overrides for PlanItems no longer
 * part of the Scenario's date (hard-deleted PlanItems already cascade via
 * the FK; this additionally covers an item that somehow left the date
 * without being deleted).
 */
export async function pruneScenarioItemOverrides(
  scenarioId: string,
  currentPlanItemIds: string[],
): Promise<void> {
  await prisma.dayScenarioItemOverride.deleteMany({
    where: { scenarioId, planItemId: { notIn: currentPlanItemIds } },
  });
}

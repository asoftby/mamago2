import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calendarDaySchema } from "@/lib/decision/planRequestSchemas";
import { getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { activePlanScopeFor } from "@/server/family/familyAccess";

/**
 * «Перенести» for a plan entry that points at a place, an offer or a route: the date changes, the time of day stays
 * (an entry with a start keeps its local clock time on the new day; one without stays «в любое время»). Events keep
 * their own flow (sessions), notes theirs (/api/plan/manual). Everything else of the entry, including the scenario
 * that created it, is untouched. Optimistic concurrency by updatedAt, like the other plan edits.
 */

export class PlanEntryMoveError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export function parseMoveRequest(body: unknown): { date: string; expectedUpdatedAt: Date } {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const date = calendarDaySchema.safeParse(raw.date);
  if (!date.success) throw new PlanEntryMoveError(400, "INVALID_DATE");
  const expected = typeof raw.expectedUpdatedAt === "string" ? new Date(raw.expectedUpdatedAt) : null;
  if (!expected || Number.isNaN(expected.getTime())) throw new PlanEntryMoveError(400, "INVALID_EXPECTED_UPDATED_AT");
  return { date: date.data, expectedUpdatedAt: expected };
}

/** Local "HH:mm" of an instant in the project time zone. */
function clockOf(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}`;
}

/** The entry's start/end on another day: same local clock time, same length. null stays null. */
export function movedTimes(startsAt: Date | null, endsAt: Date | null, newDate: string, timeZone: string = DEFAULT_TZ): { startsAt: Date | null; endsAt: Date | null } {
  if (!startsAt) return { startsAt: null, endsAt: null };
  const start = localWallClockToUtc(newDate, clockOf(startsAt, timeZone), timeZone);
  return { startsAt: start, endsAt: endsAt ? new Date(start.getTime() + (endsAt.getTime() - startsAt.getTime())) : null };
}

/** Only entries that point at a place, an offer or a route and were not made by hand are moved here. */
export function isMovableLinkedEntry(item: { activityId: string | null; articleId: string | null; placeId: string | null; planPlaceSlug: string | null; offerId: string | null; routeId: string | null; planRouteSlug: string | null }): boolean {
  if (item.activityId || item.articleId) return false;
  return Boolean(item.placeId || item.planPlaceSlug || item.offerId || item.routeId || item.planRouteSlug);
}

export type MoveDeps = {
  db?: Pick<typeof prisma, "$transaction">;
  scopeFor?: (userId: string) => Promise<Prisma.PlanItemWhereInput>;
  today?: string;
};

export async function moveLinkedPlanEntry(userId: string, itemId: string, request: { date: string; expectedUpdatedAt: Date }, deps: MoveDeps = {}): Promise<{ id: string; date: string; startsAt: string | null; updatedAt: string }> {
  if (request.date < (deps.today ?? getLocalDateKey())) throw new PlanEntryMoveError(422, "PAST_DAY");
  const scope = await (deps.scopeFor ?? activePlanScopeFor)(userId);
  const select = { id: true, date: true, startsAt: true, endsAt: true, updatedAt: true, scenarioId: true, activityId: true, articleId: true, placeId: true, planPlaceSlug: true, offerId: true, routeId: true, planRouteSlug: true } as const;
  return (deps.db ?? prisma).$transaction(async (tx) => {
    // A scenario point is also written by the scenario's save, which holds the DayScenario row lock for its whole
    // transaction. The move takes the same lock and reads the entry again under it, so the two never interleave: a
    // successful move cannot be undone or deleted by a save that read the point before it.
    const first = await tx.planItem.findFirst({ where: { AND: [scope, { id: itemId }] }, select: { scenarioId: true } });
    if (first?.scenarioId) await tx.$queryRaw`SELECT id FROM "DayScenario" WHERE id = ${first.scenarioId} FOR UPDATE`;
    const current = await tx.planItem.findFirst({ where: { AND: [scope, { id: itemId }] }, select });
    if (!current) throw new PlanEntryMoveError(404, "NOT_FOUND");
    if (!isMovableLinkedEntry(current)) throw new PlanEntryMoveError(422, "NOT_MOVABLE");
    if (current.updatedAt.getTime() !== request.expectedUpdatedAt.getTime()) throw new PlanEntryMoveError(409, "CONFLICT");
    const times = movedTimes(current.startsAt, current.endsAt, request.date);
    const updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
    const result = await tx.planItem.updateMany({
      where: { AND: [scope, { id: itemId, updatedAt: request.expectedUpdatedAt }] },
      data: { date: request.date, startsAt: times.startsAt, endsAt: times.endsAt, updatedAt },
    });
    if (result.count !== 1) throw new PlanEntryMoveError(409, "CONFLICT");
    return { id: itemId, date: request.date, startsAt: times.startsAt?.toISOString() ?? null, updatedAt: updatedAt.toISOString() };
  });
}

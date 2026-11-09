import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calendarDaySchema } from "@/lib/decision/planRequestSchemas";
import { activePlanScopeFor } from "@/server/family/familyAccess";
import { computePlanFingerprint } from "@/server/services/dayScenario.service";

/**
 * What the day scenario saved (BACKLOG-230, PR 3b): which days of a range are «День от mamaGo» and how many
 * points each has, and removing such a day (or both days of a weekend). Only entries the scenario itself created
 * (PlanItem.scenarioId) are ever read as its points or deleted; manual and other entries of the day stay.
 */

export type SavedDayInfo = { scenarioId: string; groupId: string | null; count: number };

type Db = Pick<typeof prisma, "dayScenario" | "planItem">;

/**
 * Saved days of the user in [from, to], keyed by date. Two small indexed reads (the scenario rows, then one grouped
 * count of their points). A saved day whose points were all deleted by hand is not listed.
 */
export async function listSavedDays(userId: string, from: string, to: string, db: Db = prisma): Promise<Record<string, SavedDayInfo>> {
  const rows = await db.dayScenario.findMany({
    where: { userId, source: "ENGINE", date: { gte: from, lte: to } },
    select: { id: true, date: true, groupId: true },
  });
  if (rows.length === 0) return {};
  const counts = await db.planItem.groupBy({
    by: ["scenarioId"],
    where: { scenarioId: { in: rows.map((row) => row.id) }, cancelledAt: null },
    _count: { _all: true },
  });
  const countOf = new Map(counts.map((entry) => [entry.scenarioId, entry._count._all]));
  const out: Record<string, SavedDayInfo> = {};
  for (const row of rows) {
    const count = countOf.get(row.id) ?? 0;
    if (count > 0) out[row.date] = { scenarioId: row.id, groupId: row.groupId, count };
  }
  return out;
}

export class SavedDayError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export type DeleteScope = "day" | "group";

export function parseDeleteRequest(date: string | null, scope: string | null): { date: string; scope: DeleteScope } {
  const parsed = calendarDaySchema.safeParse(date ?? "");
  if (!parsed.success) throw new SavedDayError(400, "INVALID_DATE");
  if (scope !== "day" && scope !== "group") throw new SavedDayError(400, "INVALID_SCOPE");
  return { date: parsed.data, scope };
}

export type SavedDayDeps = {
  db?: Pick<typeof prisma, "$transaction">;
  scopeFor?: (userId: string) => Promise<Prisma.PlanItemWhereInput>;
};

/**
 * Removes the day (scope "day") or every day of its saved group (scope "group", e.g. the weekend) in one transaction:
 * the scenario's own entries are deleted, the DayScenario rows stay (the plan editor may hold overrides on them) but
 * stop being «от mamaGo», and their fingerprints are recomputed so the editor does not report a phantom change.
 * Returns the dates that changed. A group scope on a day that has no group removes just that day.
 */
export async function deleteSavedDays(userId: string, date: string, scope: DeleteScope, deps: SavedDayDeps = {}): Promise<{ dates: string[] }> {
  const scopeFor = deps.scopeFor ?? activePlanScopeFor;
  const planScope = await scopeFor(userId);
  return (deps.db ?? prisma).$transaction(async (tx) => {
    const day = await tx.dayScenario.findUnique({ where: { userId_date: { userId, date } }, select: { id: true, date: true, groupId: true, source: true } });
    if (!day || day.source !== "ENGINE") throw new SavedDayError(404, "NOT_A_SAVED_DAY");
    const rows =
      scope === "group" && day.groupId
        ? await tx.dayScenario.findMany({ where: { userId, source: "ENGINE", groupId: day.groupId }, select: { id: true, date: true, acceptedConflictKeys: true }, orderBy: { date: "asc" } })
        : await tx.dayScenario.findMany({ where: { id: day.id }, select: { id: true, date: true, acceptedConflictKeys: true } });
    if (rows.length > 1) {
      // Same lock order as the save (date ascending) so a save and a delete cannot deadlock.
      await tx.$queryRaw`SELECT id FROM "DayScenario" WHERE id = ANY(${rows.map((row) => row.id)}::text[]) ORDER BY "date" FOR UPDATE`;
    } else {
      await tx.$queryRaw`SELECT id FROM "DayScenario" WHERE id = ${rows[0]!.id} FOR UPDATE`;
    }
    await tx.planItem.deleteMany({ where: { scenarioId: { in: rows.map((row) => row.id) }, userId } });
    for (const row of rows) {
      const items = await tx.planItem.findMany({
        where: { AND: [planScope, { date: row.date }] },
        select: { id: true, activityId: true, routeId: true, placeId: true, articleId: true, date: true, startsAt: true, endsAt: true, childId: true },
      });
      await tx.dayScenario.update({
        where: { id: row.id },
        data: { source: null, groupId: null, legsJson: Prisma.JsonNull, planFingerprint: computePlanFingerprint(items, new Map(), row.acceptedConflictKeys) },
      });
    }
    return { dates: rows.map((row) => row.date) };
  });
}

export type SavedDayPoint = { kind: "event" | "place"; activityId: string; startsAt: string; pinned: boolean };

/**
 * The points of a saved day, for «Изменить день»: what the scenario created (PlanItem.scenarioId), in time order.
 * The draft is rebuilt around them (all pinned), so only ids and starts are needed; their cards come from the pool.
 * Empty for a day that is not a saved scenario of this user.
 */
export async function listSavedDayPoints(userId: string, date: string, db: Pick<typeof prisma, "dayScenario" | "planItem"> = prisma): Promise<SavedDayPoint[]> {
  const scenario = await db.dayScenario.findUnique({ where: { userId_date: { userId, date } }, select: { id: true, source: true } });
  if (!scenario || scenario.source !== "ENGINE") return [];
  const rows = await db.planItem.findMany({
    where: { scenarioId: scenario.id, userId, cancelledAt: null, startsAt: { not: null } },
    select: { activityId: true, placeId: true, startsAt: true, pinned: true },
    orderBy: { startsAt: "asc" },
  });
  return rows.flatMap((row) =>
    row.startsAt && (row.activityId || row.placeId)
      ? [{ kind: row.activityId ? ("event" as const) : ("place" as const), activityId: (row.activityId ?? row.placeId)!, startsAt: row.startsAt.toISOString(), pinned: row.pinned }]
      : [],
  );
}

import { Prisma, PlanEntryType, PlanItemSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expandRecurrence, type RecurrenceRule } from "@/lib/plan/recurrence";
import { localWallClockToUtc } from "@/lib/date/localDateKey";
import { familyReadsEnabled, resolveFamilyScope } from "@/server/family/familyAccess";
import type { PlanOwner } from "@/server/services/planOwner";

const MAX_SERIES = 100;
const MAX_INSERTS = 2000;

type Series = {
  id: string;
  ownerUserId: string;
  familyId: string | null;
  visibility: "PRIVATE" | "FAMILY";
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  startDate: string;
  untilDate: string | null;
  weekdays: number[];
  maxOccurrences: number | null;
  template: Prisma.JsonValue;
};

export function planRecurrenceInsertRows(series: Series[], from: string, to: string) {
  const rows: Prisma.PlanItemCreateManyInput[] = [];
  for (const item of series) {
    if (!item.template || typeof item.template !== "object" || Array.isArray(item.template)) throw Error("invalid_recurrence_template");
    const template = item.template as Record<string, unknown>;
    if (typeof template.title !== "string" || typeof template.time !== "string" && template.time !== null ||
        typeof template.reminderEnabled !== "boolean" || template.lead !== null && typeof template.lead !== "number") {
      throw Error("invalid_recurrence_template");
    }
    const rule: RecurrenceRule = {
      frequency: item.frequency, interval: item.interval, startDate: item.startDate,
      weekdays: item.weekdays, untilDate: item.untilDate, maxOccurrences: item.maxOccurrences,
    };
    for (const date of expandRecurrence(rule, from, to)) {
      // Never fail the calendar read solely because expansion reached its budget.
      if (rows.length >= MAX_INSERTS) return rows;
      rows.push({
        recurrenceSeriesId: item.id,
        recurrenceDate: date,
        userId: item.ownerUserId,
        familyId: item.familyId,
        visibility: item.visibility,
        source: PlanItemSource.MANUAL,
        entryType: PlanEntryType.TASK,
        title: template.title,
        date,
        childId: typeof template.childId === "string" ? template.childId : null,
        assigneeUserId: typeof template.assigneeUserId === "string" ? template.assigneeUserId : null,
        startsAt: template.time ? localWallClockToUtc(date, template.time) : null,
        reminderEnabled: template.reminderEnabled,
        reminderLeadMinutes: template.lead as number | null,
      });
    }
  }
  return rows;
}

/** Bounded, retry-safe materialization before normal calendar read.
 * Cancelled instances keep their unique recurrence keys and are never restored.
 */
export async function materializeRecurrencesForRange(owner: PlanOwner, from: string, to: string) {
  const scope = await resolveFamilyScope(owner.userId);
  const shared = familyReadsEnabled() && scope.familyId
    ? { familyId: scope.familyId, visibility: "FAMILY" as const }
    : null;
  await prisma.$transaction(async tx => {
    const initial = await tx.planRecurrenceSeries.findMany({
      where: {
        stoppedAt: null,
        startDate: { lte: to },
        OR: [
          { ownerUserId: owner.userId },
          ...(shared ? [shared] : []),
        ],
      },
      take: MAX_SERIES,
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (initial.length === 0) return;

    // Shared locks can coexist across calendar reads. A series cancellation
    // needs an exclusive row lock, so it either waits for the inserts to finish
    // and cancels them, or completes before the fresh series read below.
    const ids = initial.map(item => item.id);
    await tx.$queryRaw`SELECT "id" FROM "PlanRecurrenceSeries"
      WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR SHARE`;

    // Re-read after lock acquisition: an update may have changed untilDate or
    // stoppedAt between the initial query and acquiring the shared lock.
    const active = await tx.planRecurrenceSeries.findMany({
      where: { id: { in: ids }, stoppedAt: null, startDate: { lte: to } },
      orderBy: { createdAt: "asc" },
    });
    const rows = planRecurrenceInsertRows(active, from, to);
    if (rows.length) await tx.planItem.createMany({ data: rows, skipDuplicates: true });
  });

}

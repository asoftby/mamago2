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
        reminderAt: template.time && template.reminderEnabled && typeof template.lead === "number"
          ? new Date(localWallClockToUtc(date, template.time).getTime() - template.lead * 60_000) : null,
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
    // A child may be deleted or an adult may leave the family after the
    // recurring series was created. Never let stale template assignments
    // break every calendar read or assign future tasks outside the family.
    const templates = active.map(series =>
      series.template && typeof series.template === "object" && !Array.isArray(series.template)
        ? series.template as Record<string, unknown> : {});
    const childIds = [...new Set(templates.map(t => t.childId).filter((v): v is string => typeof v === "string"))];
    const adultIds = [...new Set(templates.map(t => t.assigneeUserId).filter((v): v is string => typeof v === "string"))];
    const children = childIds.length ? await tx.child.findMany({
      where: { id: { in: childIds } }, select: { id: true, parentId: true, familyId: true },
    }) : [];
    const memberRows = adultIds.length && familyReadsEnabled() ? await tx.familyMembership.findMany({
      where: { userId: { in: adultIds }, familyId: { in: active.map(s => s.familyId).filter((v): v is string => Boolean(v)) }, leftAt: null },
      select: { userId: true, familyId: true },
    }) : [];
    const permittedChildren = new Map(children.map(child => [child.id, child]));
    const permittedAdults = new Set(memberRows.map(member => `${member.familyId}:${member.userId}`));
    const sanitized = active.map((series, index) => {
      const template = templates[index]!;
      const childId = typeof template.childId === "string" ? template.childId : null;
      const assigneeUserId = typeof template.assigneeUserId === "string" ? template.assigneeUserId : null;
      const child = childId ? permittedChildren.get(childId) : null;
      const childAllowed = child && (familyReadsEnabled()
        ? Boolean(series.familyId && child.familyId === series.familyId)
        : child.parentId === series.ownerUserId);
      const adultAllowed = assigneeUserId && (familyReadsEnabled()
        ? Boolean(series.familyId && permittedAdults.has(`${series.familyId}:${assigneeUserId}`))
        : assigneeUserId === series.ownerUserId);
      // Existing template is already a Prisma JSON value. We only replace
      // two entries with strings or null, retaining JSON compatibility.
      const sanitizedTemplate: Prisma.JsonValue = {
        ...template,
        childId: childAllowed ? childId : null,
        assigneeUserId: adultAllowed ? assigneeUserId : null,
      } as Prisma.JsonObject;
      return { ...series, template: sanitizedTemplate };
    });
    const rows = planRecurrenceInsertRows(sanitized, from, to);
    if (rows.length) await tx.planItem.createMany({ data: rows, skipDuplicates: true });
  });

}

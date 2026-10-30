import { Prisma, PlanEntryType, PlanItemSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeFamilyUserIds, activePlanScopeFor, childScopeFor, familyIdForWrite } from "@/server/family/familyAccess";
import { localWallClockToUtc } from "@/lib/date/localDateKey";
import { validateRecurrenceInput } from "@/lib/plan/recurrenceInput";
import type { PlanOwner } from "@/server/services/planOwner";

export type NewRecurringTask = {
  requestKey: string;
  title: string;
  startTime?: string | null;
  reminderEnabled?: boolean;
  reminderLeadMinutes?: number | null;
  recurrence: unknown;
  childId?: string | null;
  assigneeUserId?: string | null;
};

export function validateRecurringTask(value: NewRecurringTask) {
  const key = value.requestKey;
  if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new Error("invalid_request_key");
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 160 || /[<>]/.test(value.title)) throw new Error("invalid_title");
  if (value.startTime != null && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.startTime)) throw new Error("invalid_start_time");
  const lead = value.reminderLeadMinutes;
  if (lead != null && (!Number.isInteger(lead) || lead < 1 || lead > 28 * 24 * 60 || !value.startTime || value.reminderEnabled !== true)) throw new Error("invalid_reminder");
  const childId = value.childId ?? null;
  const assigneeUserId = value.assigneeUserId ?? null;
  if (childId !== null && (typeof childId !== "string" || !childId || childId.length > 128)) throw new Error("invalid_child");
  if (assigneeUserId !== null && (typeof assigneeUserId !== "string" || !assigneeUserId || assigneeUserId.length > 128)) throw new Error("invalid_assignee");
  if (childId && assigneeUserId) throw new Error("assignee_and_child");
  const rule = validateRecurrenceInput(value.recurrence);
  return { key, title: value.title.trim(), time: value.startTime || null, reminderEnabled: value.reminderEnabled === true, lead: lead ?? null, rule, childId, assigneeUserId };
}

/** PostgreSQL JSONB does not preserve object key insertion order. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return "{" + Object.keys(object).sort().map(key => JSON.stringify(key) + ":" + stableJson(object[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

/** Internal-only, atomic creation. Keep API hidden until family/series lifecycle wiring is ready. */
export async function createRecurringTaskSeries(owner: PlanOwner, input: NewRecurringTask) {
  const validated = validateRecurringTask(input);
  const { key, title, time, reminderEnabled, lead, rule, childId, assigneeUserId } = validated;
  if (childId && !(await prisma.child.findFirst({
    where: { id: childId, ...(await childScopeFor(owner.userId)) }, select: { id: true },
  }))) throw new Error("child_not_found");
  if (assigneeUserId && !(await activeFamilyUserIds(owner.userId)).includes(assigneeUserId)) throw new Error("assignee_not_found");
  const familyId = await familyIdForWrite(owner.userId);
  const template = { title, time, reminderEnabled, lead, ...(childId ? { childId } : {}), ...(assigneeUserId ? { assigneeUserId } : {}), rule: { frequency: rule.frequency, interval: rule.interval, startDate: rule.startDate, weekdays: rule.weekdays ?? [], untilDate: rule.untilDate ?? null, maxOccurrences: rule.maxOccurrences ?? null } };
  const existing = await prisma.planRecurrenceSeries.findUnique({ where: { requestKey: key }, select: { id: true, ownerUserId: true, template: true } });
  if (existing) {
    if (existing.ownerUserId !== owner.userId || stableJson(existing.template) !== stableJson(template)) throw new Error("idempotency_conflict");
    return existing.id;
  }
  try {
    return await prisma.$transaction(async tx => {
      const series = await tx.planRecurrenceSeries.create({
        data: {
          requestKey: key,
          ownerUserId: owner.userId, familyId, visibility: "FAMILY", timezone: "Europe/Minsk",
          frequency: rule.frequency, interval: rule.interval, weekdays: rule.weekdays ?? [],
          startDate: rule.startDate, untilDate: rule.untilDate, maxOccurrences: rule.maxOccurrences,
          template,
        },
      });
      await tx.planItem.create({
        data: {
          userId: owner.userId, familyId, visibility: "FAMILY", source: PlanItemSource.MANUAL,
          entryType: PlanEntryType.TASK, title, date: rule.startDate,
          childId, assigneeUserId,
          startsAt: time ? localWallClockToUtc(rule.startDate, time) : null,
          reminderEnabled, reminderLeadMinutes: lead,
          reminderAt: time && reminderEnabled && lead != null ? new Date(localWallClockToUtc(rule.startDate, time).getTime() - lead * 60_000) : null,
          recurrenceSeriesId: series.id, recurrenceDate: rule.startDate,
        },
      });
      return series.id;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const current = await prisma.planRecurrenceSeries.findUnique({ where: { requestKey: key }, select: { id: true, ownerUserId: true, template: true } });
      if (current?.ownerUserId === owner.userId && stableJson(current.template) === stableJson(template)) return current.id;
      throw new Error("idempotency_conflict");
    }
    throw error;
  }
}

export type RecurrenceCancelScope = "FUTURE" | "ALL";

export class RecurrenceMutationError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "CONFLICT" | "INVALID_INPUT", message: string) {
    super(message);
  }
}

/** Stop upcoming occurrences or the whole series; do not delete tombstones.
 * Only the series owner can change the shared recurrence rule.
 */
export async function cancelRecurringTaskSeries(
  owner: PlanOwner,
  itemId: string,
  scope: RecurrenceCancelScope,
  expectedUpdatedAt: string,
): Promise<void> {
  if (scope !== "FUTURE" && scope !== "ALL") throw new RecurrenceMutationError("INVALID_INPUT", "invalid_scope");
  const expected = new Date(expectedUpdatedAt);
  if (typeof expectedUpdatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(expectedUpdatedAt) ||
      Number.isNaN(expected.getTime()) || expected.toISOString() !== expectedUpdatedAt) {
    throw new RecurrenceMutationError("INVALID_INPUT", "invalid_expected_updated_at");
  }
  const planScope = await activePlanScopeFor(owner.userId);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.$transaction(async tx => {
        const item = await tx.planItem.findFirst({
          where: { id: itemId, ...planScope, source: "MANUAL", status: "CONFIRMED" },
          select: { id: true, recurrenceSeriesId: true, recurrenceDate: true, updatedAt: true },
        });
        if (!item?.recurrenceSeriesId || !item.recurrenceDate) {
          throw new RecurrenceMutationError("NOT_FOUND", "recurrence_not_found");
        }
        if (item.updatedAt.getTime() !== expected.getTime()) {
          throw new RecurrenceMutationError("CONFLICT", "conflict");
        }
        // FOR UPDATE conflicts with the materializer's FOR SHARE. When a
        // calendar read is already inserting occurrences, wait for its commit
        // before cancelling rows; subsequent reads wait for this mutation.
        await tx.$queryRaw`SELECT "id" FROM "PlanRecurrenceSeries"
          WHERE "id" = ${item.recurrenceSeriesId} FOR UPDATE`;

        // A previous cancellation may have committed while we acquired the
        // lock. Re-check the occurrence against its latest version.
        const fresh = await tx.planItem.findFirst({
          where: { id: itemId, ...planScope, source: "MANUAL", status: "CONFIRMED" },
          select: { updatedAt: true },
        });
        if (!fresh) throw new RecurrenceMutationError("NOT_FOUND", "recurrence_not_found");
        if (fresh.updatedAt.getTime() !== expected.getTime()) {
          throw new RecurrenceMutationError("CONFLICT", "conflict");
        }
        const series = await tx.planRecurrenceSeries.findFirst({
          where: { id: item.recurrenceSeriesId, ownerUserId: owner.userId, stoppedAt: null },
          select: { id: true, version: true, untilDate: true },
        });
        if (!series) throw new RecurrenceMutationError("NOT_FOUND", "recurrence_not_found");
        const cancelledAt = new Date();
        const cutoff = item.recurrenceDate;
        const before = new Date(Date.parse(`${cutoff}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
        const result = await tx.planRecurrenceSeries.updateMany({
          where: { id: series.id, ownerUserId: owner.userId, stoppedAt: null, version: series.version },
          data: scope === "ALL"
            ? { stoppedAt: cancelledAt, version: { increment: 1 } }
            : { untilDate: series.untilDate && series.untilDate < before ? series.untilDate : before,
                version: { increment: 1 } },
        });
        if (result.count !== 1) throw new RecurrenceMutationError("CONFLICT", "conflict");
        await tx.planItem.updateMany({
          where: {
            recurrenceSeriesId: series.id,
            ...(scope === "FUTURE" ? { recurrenceDate: { gte: cutoff } } : {}),
            status: { not: "CANCELLED" },
          },
          data: { status: "CANCELLED", cancelledAt, updatedAt: cancelledAt },
        });
      });
      return;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 4) continue;
      throw error;
    }
  }
}

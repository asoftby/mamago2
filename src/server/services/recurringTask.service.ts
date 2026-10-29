import { Prisma, PlanEntryType, PlanItemSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { familyIdForWrite } from "@/server/family/familyAccess";
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
};

export function validateRecurringTask(value: NewRecurringTask) {
  const key = value.requestKey;
  if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(key)) throw new Error("invalid_request_key");
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 160 || /[<>]/.test(value.title)) throw new Error("invalid_title");
  if (value.startTime != null && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.startTime)) throw new Error("invalid_start_time");
  const lead = value.reminderLeadMinutes;
  if (lead != null && (!Number.isInteger(lead) || lead < 1 || lead > 1440 || !value.startTime || value.reminderEnabled !== true)) throw new Error("invalid_reminder");
  const rule = validateRecurrenceInput(value.recurrence);
  return { key, title: value.title.trim(), time: value.startTime || null, reminderEnabled: value.reminderEnabled === true, lead: lead ?? null, rule };
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
  const { key, title, time, reminderEnabled, lead, rule } = validated;
  const familyId = await familyIdForWrite(owner.userId);
  const template = { title, time, reminderEnabled, lead, rule: { frequency: rule.frequency, interval: rule.interval, startDate: rule.startDate, weekdays: rule.weekdays ?? [], untilDate: rule.untilDate ?? null, maxOccurrences: rule.maxOccurrences ?? null } };
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
          startsAt: time ? localWallClockToUtc(rule.startDate, time) : null,
          reminderEnabled, reminderLeadMinutes: lead,
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

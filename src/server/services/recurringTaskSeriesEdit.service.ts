import { Prisma, PlanEntryType, PlanItemSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { localWallClockToUtc, getLocalDateKey } from "@/lib/date/localDateKey";
import { expandRecurrence, type RecurrenceRule } from "@/lib/plan/recurrence";
import { activePlanScopeFor, activeFamilyUserIds, childScopeFor } from "@/server/family/familyAccess";
import type { PlanOwner } from "@/server/services/planOwner";
import { RecurrenceMutationError, validateRecurringTask } from "./recurringTask.service";

export type FollowingSeriesEdit = {
  expectedUpdatedAt: string;
  expectedSeriesVersion: number;
  title: string;
  startTime: string | null;
  reminderEnabled: boolean;
  reminderLeadMinutes: number | null;
  childId: string | null;
  assigneeUserId: string | null;
  recurrence: {
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    interval: number;
    weekdays?: number[];
    untilDate?: string | null;
    maxOccurrences?: number | null;
  };
};

const invalid = (message: string) => new RecurrenceMutationError("INVALID_INPUT", message);
const notFound = () => new RecurrenceMutationError("NOT_FOUND", "recurrence_not_found");
const conflict = () => new RecurrenceMutationError("CONFLICT", "conflict");

function previousDay(day: string) {
  return new Date(Date.parse(day + "T00:00:00.000Z") - 86400000).toISOString().slice(0, 10);
}

function firstDayOnOrAfter(cutoff: string, frequency: string, weekdays: number[]): string {
  if (frequency !== "WEEKLY") return cutoff;
  for (let offset = 0; offset < 7; offset++) {
    const ms = Date.parse(cutoff + "T00:00:00.000Z") + offset * 86400000;
    const iso = new Date(ms).toISOString().slice(0, 10);
    const dow = new Date(ms).getUTCDay() || 7;
    if (weekdays.includes(dow)) return iso;
  }
  throw invalid("invalid_weekdays");
}

function validateVersion(raw: string): Date {
  if (typeof raw !== "string") throw invalid("invalid_expected_updated_at");
  const date = new Date(raw);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw) || Number.isNaN(date.getTime()) || date.toISOString() !== raw) {
    throw invalid("invalid_expected_updated_at");
  }
  return date;
}

async function recurrenceTarget(owner: PlanOwner, itemId: string) {
  const row = await prisma.planItem.findFirst({
    where: { id: itemId, ...(await activePlanScopeFor(owner.userId)), source: "MANUAL", status: "CONFIRMED" },
    select: { id: true, recurrenceDate: true, recurrenceSeriesId: true, updatedAt: true },
  });
  if (!row?.recurrenceSeriesId || !row.recurrenceDate) throw notFound();
  const series = await prisma.planRecurrenceSeries.findFirst({
    where: { id: row.recurrenceSeriesId, ownerUserId: owner.userId, stoppedAt: null },
  });
  if (!series) throw notFound();
  return { row, series };
}

/** Remaining occurrence budget after the historical part of a bounded series.
 * Expand in safe 300-day windows so the public expansion limit is respected.
 */
function remainingOccurrenceCount(series: {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number; weekdays: number[]; startDate: string;
  untilDate: string | null; maxOccurrences: number | null;
}, cutoff: string): number | null {
  if (series.maxOccurrences === null) return null;
  const startMs = Date.parse(series.startDate + "T00:00:00.000Z");
  const endMs = Date.parse(cutoff + "T00:00:00.000Z") - 86400000;
  const rule: RecurrenceRule = {
    frequency: series.frequency, interval: series.interval, weekdays: series.weekdays,
    startDate: series.startDate, untilDate: series.untilDate, maxOccurrences: series.maxOccurrences,
  };
  let consumed = 0;
  for (let ms = startMs; ms <= endMs; ms += 300 * 86400000) {
    const from = new Date(ms).toISOString().slice(0, 10);
    const to = new Date(Math.min(endMs, ms + 299 * 86400000)).toISOString().slice(0, 10);
    consumed += expandRecurrence(rule, from, to).length;
  }
  return Math.max(1, series.maxOccurrences - consumed);
}

/** Owners only; needed to pre-fill the edit form and enforce version checks. */
export async function getRecurringTaskSeriesForEdit(owner: PlanOwner, itemId: string) {
  const { row, series } = await recurrenceTarget(owner, itemId);
  const members = await activeFamilyUserIds(owner.userId);
  const users = await prisma.user.findMany({ where: { id: { in: members } },
    select: { id: true, displayName: true } });
  const people = users.map(user => ({
    id: user.id, name: user.id === owner.userId ? "Я" : user.displayName?.trim() || "Взрослый",
  }));
  const template = series.template && typeof series.template === "object" && !Array.isArray(series.template)
    ? series.template as Record<string, unknown> : {};
  return {
    expectedUpdatedAt: row.updatedAt.toISOString(),
    expectedSeriesVersion: series.version,
    cutoff: row.recurrenceDate!,
    people,
    title: typeof template.title === "string" ? template.title : "",
    startTime: typeof template.time === "string" ? template.time : null,
    childId: typeof template.childId === "string" ? template.childId : null,
    assigneeUserId: typeof template.assigneeUserId === "string" ? template.assigneeUserId : null,
    reminderEnabled: template.reminderEnabled === true,
    reminderLeadMinutes: typeof template.lead === "number" ? template.lead : null,
    recurrence: {
      frequency: series.frequency,
      interval: series.interval,
      weekdays: series.weekdays,
      untilDate: series.untilDate,
      maxOccurrences: remainingOccurrenceCount(series, row.recurrenceDate!),
    },
  };
}

/**
 * Split at selected day. Old series/history is kept unchanged until cutoff.
 * Materialized future entries are tombstoned; a new series starts at the
 * first valid date at/after cutoff and keeps its own unique occurrence keys.
 * Locks match materializer FOR SHARE to prevent cancellation/resurrection race.
 */
export async function editRecurringTaskFollowing(owner: PlanOwner, itemId: string, input: FollowingSeriesEdit) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      !Number.isSafeInteger(input.expectedSeriesVersion) || input.expectedSeriesVersion < 0) throw invalid("invalid_version");
  const expected = validateVersion(input.expectedUpdatedAt);
  const { row, series } = await recurrenceTarget(owner, itemId);
  const cutoff = row.recurrenceDate!;
  if (cutoff < getLocalDateKey(new Date())) throw invalid("past_series_edit_not_allowed");

  const newStart = firstDayOnOrAfter(cutoff, input.recurrence?.frequency, input.recurrence?.weekdays ?? []);
  let validated: ReturnType<typeof validateRecurringTask>;
  try {
    validated = validateRecurringTask({
      requestKey: "serieseditvalidation",
      title: input.title,
      startTime: input.startTime,
      reminderEnabled: input.reminderEnabled,
      reminderLeadMinutes: input.reminderLeadMinutes,
      childId: input.childId,
      assigneeUserId: input.assigneeUserId,
      recurrence: { ...input.recurrence, startDate: newStart },
    });
  } catch (error) {
    throw invalid(error instanceof Error ? error.message : "invalid_recurrence");
  }
  const { title, time, reminderEnabled, lead, childId, assigneeUserId, rule } = validated;
  if (childId && !(await prisma.child.findFirst({
    where: { id: childId, ...(await childScopeFor(owner.userId)) }, select: { id: true },
  }))) throw invalid("child_not_found");
  if (assigneeUserId && !(await activeFamilyUserIds(owner.userId)).includes(assigneeUserId)) throw invalid("assignee_not_found");

  const template = {
    title, time, reminderEnabled, lead,
    ...(childId ? { childId } : {}),
    ...(assigneeUserId ? { assigneeUserId } : {}),
    rule: { frequency: rule.frequency, interval: rule.interval, startDate: rule.startDate,
      weekdays: rule.weekdays ?? [], untilDate: rule.untilDate ?? null, maxOccurrences: rule.maxOccurrences ?? null },
  };
  const scope = await activePlanScopeFor(owner.userId);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "PlanRecurrenceSeries" WHERE "id" = ${series.id} FOR UPDATE`;
        const current = await tx.planRecurrenceSeries.findFirst({
          where: { id: series.id, ownerUserId: owner.userId, stoppedAt: null },
        });
        if (!current) throw conflict();
        if (current.version !== input.expectedSeriesVersion) throw conflict();
        const selected = await tx.planItem.findFirst({
          where: { id: itemId, ...scope, source: "MANUAL", status: "CONFIRMED" },
          select: { updatedAt: true, recurrenceDate: true, recurrenceSeriesId: true },
        });
        if (!selected || selected.updatedAt.getTime() !== expected.getTime() ||
            selected.recurrenceDate !== cutoff || selected.recurrenceSeriesId !== series.id) throw conflict();
        const now = new Date();
        const updated = await tx.planRecurrenceSeries.updateMany({
          where: { id: series.id, ownerUserId: owner.userId, stoppedAt: null, version: current.version },
          data: { untilDate: current.untilDate && current.untilDate < previousDay(cutoff)
            ? current.untilDate : previousDay(cutoff), version: { increment: 1 } },
        });
        if (updated.count !== 1) throw conflict();
        await tx.planItem.updateMany({
          where: { recurrenceSeriesId: series.id, recurrenceDate: { gte: cutoff }, status: { not: "CANCELLED" } },
          data: { status: "CANCELLED", cancelledAt: now, updatedAt: now },
        });
        const replacement = await tx.planRecurrenceSeries.create({
          data: {
            ownerUserId: owner.userId, familyId: current.familyId,
            visibility: current.visibility, timezone: "Europe/Minsk",
            frequency: rule.frequency, interval: rule.interval, weekdays: rule.weekdays ?? [],
            startDate: rule.startDate, untilDate: rule.untilDate, maxOccurrences: rule.maxOccurrences,
            template,
          },
        });
        await tx.planItem.create({
          data: {
            userId: owner.userId, familyId: current.familyId, visibility: current.visibility,
            source: PlanItemSource.MANUAL, entryType: PlanEntryType.TASK,
            title, date: newStart, childId, assigneeUserId,
            startsAt: time ? localWallClockToUtc(newStart, time) : null,
            reminderEnabled, reminderLeadMinutes: lead,
            reminderAt: time && reminderEnabled && lead != null
              ? new Date(localWallClockToUtc(newStart, time).getTime() - lead * 60_000) : null,
            recurrenceSeriesId: replacement.id, recurrenceDate: newStart,
          },
        });
        return { seriesId: replacement.id, startDate: newStart };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 4) continue;
      throw error;
    }
  }
  throw conflict();
}

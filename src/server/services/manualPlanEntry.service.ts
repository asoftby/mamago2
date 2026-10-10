import { PlanEntryType, PlanItemSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import type { PlanOwner } from "@/server/services/planOwner";
import { getPlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";
import { buildPlanCardPresentation } from "@/features/my-plan/lib/planPagePresentation";
import { activeFamilyUserIds, activePlanScopeFor, childScopeFor, familyIdForWrite } from "@/server/family/familyAccess";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import type { PlanBookingState } from "@/server/family/planBookingPure";
import {
  detectPlanItemCategory,
  isPlanItemCategoryKey,
  type PlanItemCategoryKey,
} from "@/features/my-plan/lib/planItemCategory";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const TITLE_MAX = 160;
const LOCATION_MAX = 240;
const NOTES_MAX = 2_000;
const TAG_MAX = 32;
const TAG_COUNT_MAX = 12;
/** Допустимые значения «за сколько напомнить» (укладываются в окно джоба напоминаний, 180 мин). */
export const REMINDER_LEAD_MINUTES_OPTIONS = [15, 60, 120] as const;
export const FAMILY_CALENDAR_MAX_RANGE_DAYS = 42;

export class ManualPlanEntryError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}

export type ManualPlanEntryInput = {
  /** Internal legacy shape. The universal note form does not ask the user for a type. */
  entryType?: PlanEntryType;
  title: string;
  childId?: string | null;
  date: string;
  startsAt?: string | null;
  endsAt?: string | null;
  dueAt?: string | null;
  dueHasTime?: boolean;
  locationText?: string | null;
  notes?: string | null;
  tags?: string[];
  /** Ключ категории (planItemCategory). Не передан при создании → определяется по названию. */
  category?: string | null;
  reminderEnabled?: boolean;
  /** За сколько минут напомнить; null/не передан — по общему расписанию уведомлений. Нужен startsAt. */
  reminderLeadMinutes?: number | null;
  /** Взрослый член семьи, на кого дело. Не сочетается с childId. */
  assigneeUserId?: string | null;
};

export type ManualPlanEntryPatch = Partial<ManualPlanEntryInput>;

function expectedVersion(value: unknown): Date {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new ManualPlanEntryError("INVALID_INPUT", "invalid_expected_updated_at");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new ManualPlanEntryError("INVALID_INPUT", "invalid_expected_updated_at");
  }
  return date;
}

const calendarActivitySelect = {
  id: true,
  slug: true,
  title: true,
  type: true,
  coverImageUrl: true,
  ageLabel: true,
  eventCategory: { select: { nameRu: true } },
  priceMode: true,
  priceFrom: true,
  priceText: true,
  currency: true,
  status: true,
  owner: { select: { business: { select: { operationalStatus: true } } } },
  place: {
    select: {
      title: true,
      shortAddress: true,
      formattedAddr: true,
      customAddress: true,
      city: { select: { name: true } },
    },
  },
  venue: {
    select: {
      title: true,
      addressLine: true,
      kind: true,
      place: {
        select: {
          title: true,
          shortAddress: true,
          formattedAddr: true,
          customAddress: true,
          city: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.ActivitySelect;

const calendarItemSelect = {
  id: true,
  source: true,
  entryType: true,
  date: true,
  startsAt: true,
  endsAt: true,
  dueAt: true,
  dueHasTime: true,
  title: true,
  childId: true,
  locationText: true,
  notes: true,
  tags: true,
  category: true,
  reminderEnabled: true,
  reminderLeadMinutes: true,
  assigneeUserId: true,
  activityId: true,
  coverImageUrl: true,
  createdAt: true,
  userId: true,
  familyId: true,
  visibility: true,
  status: true,
  updatedAt: true,
  child: { select: { id: true, name: true } },
  activity: { select: calendarActivitySelect },
} satisfies Prisma.PlanItemSelect;

type CalendarRow = Prisma.PlanItemGetPayload<{ select: typeof calendarItemSelect }>;

export type FamilyCalendarItemDto = {
  id: string;
  source: PlanItemSource;
  entryType: PlanEntryType | null;
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  dueAt: string | null;
  dueHasTime: boolean;
  effectiveStartsAt: string | null;
  title: string | null;
  childId: string | null;
  childName: string | null;
  assigneeUserId: string | null;
  reminderLeadMinutes: number | null;
  locationText: string | null;
  notes: string | null;
  tags: string[];
  category: string | null;
  reminderEnabled: boolean | null;
  activityId: string | null;
  coverImageUrl: string | null;
  visibility: "PRIVATE" | "FAMILY";
  status: "PROPOSED" | "CONFIRMED" | "CANCELLED";
  authorId: string;
  authorName: string | null;
  updatedAt: string;
  booking?: PlanBookingState | null;
  planAvailability: ReturnType<typeof getPlanActivityPublicAvailability>;
  activity: null | {
    id: string;
    slug: string | null;
    title: string;
    type: string;
    coverImageUrl: string | null;
    ageLabel: string | null;
    categoryLabel: string | null;
    priceLabel: string | null;
    venueName: string | null;
    venueAddress: string | null;
  };
};

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  return parsed.toISOString().slice(0, 10) === value;
}

function assertDate(value: unknown): asserts value is string {
  if (!validDate(value)) throw new ManualPlanEntryError("INVALID_INPUT", "invalid_date");
}

function normalizeText(value: unknown, max: number, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new ManualPlanEntryError("INVALID_INPUT", `invalid_${field}`);
  const normalized = value.trim();
  if (normalized.length > max) throw new ManualPlanEntryError("INVALID_INPUT", `invalid_${field}`);
  return normalized || null;
}

function normalizeTitle(value: unknown): string {
  const title = normalizeText(value, TITLE_MAX, "title");
  if (!title || /[<>]/.test(title)) throw new ManualPlanEntryError("INVALID_INPUT", "invalid_title");
  return title;
}

/** Неизвестный ключ → ошибка; null/не передан → автоопределение по названию. */
export function normalizePlanItemCategory(value: unknown, title: string | null | undefined): PlanItemCategoryKey {
  if (value == null || value === "") return detectPlanItemCategory(title);
  if (!isPlanItemCategoryKey(value)) throw new ManualPlanEntryError("INVALID_INPUT", "invalid_category");
  return value;
}

export function normalizePlanNoteTags(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > TAG_COUNT_MAX) {
    throw new ManualPlanEntryError("INVALID_INPUT", "invalid_tags");
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") throw new ManualPlanEntryError("INVALID_INPUT", "invalid_tags");
    const tag = raw.trim().replace(/^#+/, "").trim();
    if (!tag) continue;
    if (tag.length > TAG_MAX || /[<>\n\r]/.test(tag)) {
      throw new ManualPlanEntryError("INVALID_INPUT", "invalid_tags");
    }
    const key = tag.toLocaleLowerCase("ru-RU");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

function parseWallClock(date: string, value: unknown, field: string): Date | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new ManualPlanEntryError("INVALID_INPUT", `invalid_${field}`);
  if (TIME_RE.test(value)) return localWallClockToUtc(date, value);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || getLocalDateKey(parsed) !== date) {
    throw new ManualPlanEntryError("INVALID_INPUT", `invalid_${field}`);
  }
  return parsed;
}

function wallClock(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function assertEntryType(value: unknown): asserts value is PlanEntryType {
  if (!Object.values(PlanEntryType).includes(value as PlanEntryType)) {
    throw new ManualPlanEntryError("INVALID_INPUT", "invalid_entry_type");
  }
}

function normalizeChildId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 128) {
    throw new ManualPlanEntryError("INVALID_INPUT", "invalid_child_id");
  }
  return value;
}

function normalizeReminderLeadMinutes(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !(REMINDER_LEAD_MINUTES_OPTIONS as readonly number[]).includes(value)) {
    throw new ManualPlanEntryError("INVALID_INPUT", "invalid_reminder_lead");
  }
  return value;
}

function normalizeAssigneeUserId(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 128) {
    throw new ManualPlanEntryError("INVALID_INPUT", "invalid_assignee");
  }
  return value;
}

async function assertFamilyAssignee(owner: PlanOwner, assigneeUserId: string | null): Promise<void> {
  if (!assigneeUserId) return;
  const memberIds = await activeFamilyUserIds(owner.userId);
  if (!memberIds.includes(assigneeUserId)) throw new ManualPlanEntryError("NOT_FOUND", "assignee_not_found");
}

async function assertOwnedChild(owner: PlanOwner, childId: string | null): Promise<void> {
  if (!childId) return;
  const child = await prisma.child.findFirst({
    where: { id: childId, ...(await childScopeFor(owner.userId)) },
    select: { id: true },
  });
  if (!child) throw new ManualPlanEntryError("NOT_FOUND", "child_not_found");
}

function assertTimeOrder(startsAt: Date | null, endsAt: Date | null): void {
  if (endsAt && !startsAt) throw new ManualPlanEntryError("INVALID_INPUT", "end_requires_start");
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new ManualPlanEntryError("INVALID_INPUT", "end_before_start");
  }
}

export async function createManualPlanEntry(owner: PlanOwner, input: ManualPlanEntryInput) {
  const entryType = input.entryType ?? PlanEntryType.TASK;
  assertEntryType(entryType);
  assertDate(input.date);
  const title = normalizeTitle(input.title);
  const childId = normalizeChildId(input.childId);
  await assertOwnedChild(owner, childId);
  const assigneeUserId = normalizeAssigneeUserId(input.assigneeUserId);
  if (assigneeUserId && childId) throw new ManualPlanEntryError("INVALID_INPUT", "assignee_and_child");
  await assertFamilyAssignee(owner, assigneeUserId);
  const startsAt = parseWallClock(input.date, input.startsAt, "starts_at");
  const endsAt = parseWallClock(input.date, input.endsAt, "ends_at");
  const dueAt = parseWallClock(input.date, input.dueAt, "due_at");
  assertTimeOrder(startsAt, endsAt);
  const reminderLeadMinutes = normalizeReminderLeadMinutes(input.reminderLeadMinutes);
  if (reminderLeadMinutes != null && (!startsAt || input.reminderEnabled !== true)) {
    throw new ManualPlanEntryError("INVALID_INPUT", "reminder_lead_requires_time");
  }

  return prisma.planItem.create({
    data: {
      userId: owner.userId,
      familyId: await familyIdForWrite(owner.userId),
      source: PlanItemSource.MANUAL,
      entryType,
      title,
      childId,
      assigneeUserId,
      date: input.date,
      startsAt,
      endsAt,
      dueAt,
      dueHasTime: input.dueHasTime === true && dueAt != null,
      locationText: normalizeText(input.locationText, LOCATION_MAX, "location"),
      notes: normalizeText(input.notes, NOTES_MAX, "notes"),
      tags: normalizePlanNoteTags(input.tags),
      category: normalizePlanItemCategory(input.category, title),
      reminderEnabled: input.reminderEnabled === true,
      reminderLeadMinutes,
    },
    select: calendarItemSelect,
  });
}

export async function updateManualPlanEntry(
  owner: PlanOwner,
  planItemId: string,
  patch: ManualPlanEntryPatch,
  expectedUpdatedAt: string,
) {
  const expected = expectedVersion(expectedUpdatedAt);
  const current = await prisma.planItem.findFirst({
    where: {
      id: planItemId,
      ...(await activePlanScopeFor(owner.userId)),
      source: PlanItemSource.MANUAL,
      status: "CONFIRMED",
    },
    select: calendarItemSelect,
  });
  if (!current) throw new ManualPlanEntryError("NOT_FOUND", "manual_item_not_found");
  if (current.updatedAt.getTime() !== expected.getTime()) {
    throw new ManualPlanEntryError("CONFLICT", "conflict");
  }

  const date = patch.date === undefined ? current.date : patch.date;
  assertDate(date);
  if (patch.entryType !== undefined) assertEntryType(patch.entryType);
  const childId = patch.childId === undefined ? current.childId : normalizeChildId(patch.childId);
  await assertOwnedChild(owner, childId ?? null);
  // Смена исполнителя на ребёнка без явного assigneeUserId снимает взрослого исполнителя.
  const assigneeUserId = patch.assigneeUserId === undefined
    ? (patch.childId !== undefined && childId ? null : current.assigneeUserId)
    : normalizeAssigneeUserId(patch.assigneeUserId);
  if (assigneeUserId && childId) throw new ManualPlanEntryError("INVALID_INPUT", "assignee_and_child");
  await assertFamilyAssignee(owner, assigneeUserId ?? null);

  const startsAt = patch.startsAt === undefined
    ? (date === current.date ? current.startsAt : parseWallClock(date, wallClock(current.startsAt), "starts_at"))
    : parseWallClock(date, patch.startsAt, "starts_at");
  const endsAt = patch.endsAt === undefined
    ? (date === current.date ? current.endsAt : parseWallClock(date, wallClock(current.endsAt), "ends_at"))
    : parseWallClock(date, patch.endsAt, "ends_at");
  const dueAt = patch.dueAt === undefined
    ? (date === current.date ? current.dueAt : parseWallClock(date, wallClock(current.dueAt), "due_at"))
    : parseWallClock(date, patch.dueAt, "due_at");
  assertTimeOrder(startsAt, endsAt);
  const reminderEnabled = patch.reminderEnabled === undefined ? current.reminderEnabled === true : patch.reminderEnabled === true;
  const requestedLeadMinutes = patch.reminderLeadMinutes === undefined
    ? current.reminderLeadMinutes
    : normalizeReminderLeadMinutes(patch.reminderLeadMinutes);
  const leadApplicable = Boolean(startsAt) && reminderEnabled;
  // Явно присланное время напоминания без времени/включённого напоминания — ошибка;
  // сохранённое ранее значение при выключении напоминания или снятии времени просто сбрасывается.
  if (patch.reminderLeadMinutes !== undefined && requestedLeadMinutes != null && !leadApplicable) {
    throw new ManualPlanEntryError("INVALID_INPUT", "reminder_lead_requires_time");
  }
  const reminderLeadMinutes = leadApplicable ? requestedLeadMinutes : null;

  const result = await prisma.planItem.updateMany({
    where: { id: current.id, ...(await activePlanScopeFor(owner.userId)), source: PlanItemSource.MANUAL, status: "CONFIRMED", updatedAt: expected },
    data: {
      updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
      ...(patch.entryType === undefined ? {} : { entryType: patch.entryType }),
      ...(patch.title === undefined ? {} : { title: normalizeTitle(patch.title) }),
      ...(patch.childId === undefined ? {} : { childId: childId ?? null }),
      ...(patch.assigneeUserId === undefined && assigneeUserId === current.assigneeUserId
        ? {}
        : { assigneeUserId: assigneeUserId ?? null }),
      ...(patch.reminderLeadMinutes === undefined && reminderLeadMinutes === current.reminderLeadMinutes
        ? {}
        : { reminderLeadMinutes }),
      ...(patch.date === undefined ? {} : { date }),
      ...(patch.startsAt === undefined && patch.date === undefined ? {} : { startsAt }),
      ...(patch.endsAt === undefined && patch.date === undefined ? {} : { endsAt }),
      ...(patch.dueAt === undefined && patch.date === undefined ? {} : { dueAt }),
      ...(patch.dueHasTime === undefined && patch.dueAt === undefined
        ? {}
        : { dueHasTime: (patch.dueHasTime ?? current.dueHasTime) === true && dueAt != null }),
      ...(patch.locationText === undefined ? {} : { locationText: normalizeText(patch.locationText, LOCATION_MAX, "location") }),
      ...(patch.notes === undefined ? {} : { notes: normalizeText(patch.notes, NOTES_MAX, "notes") }),
      ...(patch.tags === undefined ? {} : { tags: normalizePlanNoteTags(patch.tags) }),
      ...(patch.category === undefined ? {} : { category: normalizePlanItemCategory(patch.category, patch.title ?? current.title) }),
      ...(patch.reminderEnabled === undefined ? {} : { reminderEnabled: patch.reminderEnabled === true }),
    },
  });
  if (result.count === 0) throw new ManualPlanEntryError("CONFLICT", "conflict");
  const changedTime = current.date !== date || current.startsAt?.getTime() !== startsAt?.getTime()
    || current.endsAt?.getTime() !== endsAt?.getTime();
  if (changedTime) {
    await trackUserEvent({
      userId: owner.userId,
      eventType: "PLAN_ITEM_RESCHEDULED",
      familyId: current.familyId,
      planVisibility: current.visibility,
      meta: { planItemId: current.id },
    });
  }
  const updated = await prisma.planItem.findUnique({ where: { id: current.id }, select: calendarItemSelect });
  if (!updated) throw new ManualPlanEntryError("NOT_FOUND", "manual_item_not_found");
  return updated;
}

export async function cancelManualPlanEntry(owner: PlanOwner, planItemId: string, expectedUpdatedAt: string): Promise<void> {
  const expected = expectedVersion(expectedUpdatedAt);
  const current = await prisma.planItem.findFirst({
    where: { id: planItemId, ...(await activePlanScopeFor(owner.userId)), source: PlanItemSource.MANUAL, status: "CONFIRMED" },
    select: { updatedAt: true },
  });
  if (!current) throw new ManualPlanEntryError("NOT_FOUND", "manual_item_not_found");
  if (current.updatedAt.getTime() !== expected.getTime()) throw new ManualPlanEntryError("CONFLICT", "conflict");
  const result = await prisma.planItem.updateMany({
    where: { id: planItemId, ...(await activePlanScopeFor(owner.userId)), source: PlanItemSource.MANUAL, status: "CONFIRMED", updatedAt: expected },
    data: { status: "CANCELLED", cancelledAt: new Date(), updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) },
  });
  if (result.count === 0) throw new ManualPlanEntryError("CONFLICT", "conflict");
}

function inclusiveRangeDays(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000) + 1;
}

export function validateFamilyCalendarRange(from: unknown, to: unknown): { from: string; to: string } {
  assertDate(from);
  assertDate(to);
  const days = inclusiveRangeDays(from, to);
  if (days < 1 || days > FAMILY_CALENDAR_MAX_RANGE_DAYS) {
    throw new ManualPlanEntryError("INVALID_INPUT", "invalid_calendar_range");
  }
  return { from, to };
}

export async function listFamilyCalendarItems(input: {
  owner: PlanOwner;
  from: string;
  to: string;
}): Promise<FamilyCalendarItemDto[]> {
  const { from, to } = validateFamilyCalendarRange(input.from, input.to);
  const rows = await prisma.planItem.findMany({
    where: { ...(await activePlanScopeFor(input.owner.userId)), date: { gte: from, lte: to } },
    select: calendarItemSelect,
    orderBy: [
      { date: "asc" },
      { startsAt: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
  });
  const authors = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.userId))] } },
    select: { id: true, displayName: true },
  });
  const names = new Map(authors.map((author) => [author.id, author.displayName]));
  return rows.map((row) => toFamilyCalendarItemDto(row, names.get(row.userId) ?? null));
}

export function toFamilyCalendarItemDto(row: CalendarRow, authorName: string | null = null): FamilyCalendarItemDto {
  if (row.date == null) {
    throw new ManualPlanEntryError("NOT_FOUND", "calendar_item_has_no_date");
  }
  const presentation = row.activity ? buildPlanCardPresentation(row.activity) : null;
  return {
    id: row.id,
    visibility: row.visibility,
    status: row.status,
    authorId: row.userId,
    authorName,
    updatedAt: row.updatedAt.toISOString(),
    source: row.source,
    entryType: row.entryType,
    date: row.date,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    dueHasTime: row.dueHasTime,
    effectiveStartsAt: row.startsAt?.toISOString() ?? null,
    title: row.title,
    childId: row.childId,
    childName: row.child?.name?.trim() || null,
    assigneeUserId: row.assigneeUserId,
    reminderLeadMinutes: row.reminderLeadMinutes,
    locationText: row.locationText,
    notes: row.notes,
    tags: row.tags,
    category: row.category,
    reminderEnabled: row.reminderEnabled,
    activityId: row.activityId,
    coverImageUrl: row.coverImageUrl,
    planAvailability: getPlanActivityPublicAvailability(row.activity),
    activity: row.activity ? {
      id: row.activity.id,
      slug: row.activity.slug,
      title: row.activity.title,
      type: row.activity.type,
      coverImageUrl: row.activity.coverImageUrl,
      ageLabel: presentation?.ageLabel ?? null,
      categoryLabel: row.activity.eventCategory?.nameRu ?? null,
      priceLabel: presentation?.priceLabel ?? null,
      venueName: presentation?.venueName ?? null,
      venueAddress: presentation?.venueAddress ?? null,
    } : null,
  };
}

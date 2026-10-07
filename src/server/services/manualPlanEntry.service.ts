import { PlanEntryType, PlanItemSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import type { PlanOwner } from "@/server/services/planOwner";
import { getPlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";
import { buildPlanCardPresentation } from "@/features/my-plan/lib/planPagePresentation";
import { activePlanScopeFor, childScopeFor, familyIdForWrite } from "@/server/family/familyAccess";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import type { PlanBookingState } from "@/server/family/planBookingPure";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const TITLE_MAX = 160;
const LOCATION_MAX = 240;
const NOTES_MAX = 2_000;
const TAG_MAX = 32;
const TAG_COUNT_MAX = 12;
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
  reminderEnabled?: boolean;
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
  reminderEnabled: true,
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
  locationText: string | null;
  notes: string | null;
  tags: string[];
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
  const startsAt = parseWallClock(input.date, input.startsAt, "starts_at");
  const endsAt = parseWallClock(input.date, input.endsAt, "ends_at");
  const dueAt = parseWallClock(input.date, input.dueAt, "due_at");
  assertTimeOrder(startsAt, endsAt);

  return prisma.planItem.create({
    data: {
      userId: owner.userId,
      familyId: await familyIdForWrite(owner.userId),
      source: PlanItemSource.MANUAL,
      entryType,
      title,
      childId,
      date: input.date,
      startsAt,
      endsAt,
      dueAt,
      dueHasTime: input.dueHasTime === true && dueAt != null,
      locationText: normalizeText(input.locationText, LOCATION_MAX, "location"),
      notes: normalizeText(input.notes, NOTES_MAX, "notes"),
      tags: normalizePlanNoteTags(input.tags),
      reminderEnabled: input.reminderEnabled === true,
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

  const result = await prisma.planItem.updateMany({
    where: { id: current.id, ...(await activePlanScopeFor(owner.userId)), source: PlanItemSource.MANUAL, status: "CONFIRMED", updatedAt: expected },
    data: {
      updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
      ...(patch.entryType === undefined ? {} : { entryType: patch.entryType }),
      ...(patch.title === undefined ? {} : { title: normalizeTitle(patch.title) }),
      ...(patch.childId === undefined ? {} : { childId: childId ?? null }),
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
    locationText: row.locationText,
    notes: row.notes,
    tags: row.tags,
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

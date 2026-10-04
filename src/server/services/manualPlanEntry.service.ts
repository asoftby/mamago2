import { PlanEntryType, PlanItemSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import type { PlanOwner } from "@/server/services/planOwner";
import { getPlanActivityPublicAvailability } from "@/lib/plan/publicVisibility";
import { buildPlanCardPresentation } from "@/features/my-plan/lib/planPagePresentation";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const TITLE_MAX = 160;
const LOCATION_MAX = 240;
const NOTES_MAX = 2_000;
export const FAMILY_CALENDAR_MAX_RANGE_DAYS = 42;

export class ManualPlanEntryError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export type ManualPlanEntryInput = {
  entryType: PlanEntryType;
  title: string;
  childId?: string | null;
  date: string;
  startsAt?: string | null;
  endsAt?: string | null;
  dueAt?: string | null;
  dueHasTime?: boolean;
  locationText?: string | null;
  notes?: string | null;
};

export type ManualPlanEntryPatch = Partial<ManualPlanEntryInput>;

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
  activityId: true,
  coverImageUrl: true,
  createdAt: true,
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
  activityId: string | null;
  coverImageUrl: string | null;
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
    where: { id: childId, parentId: owner.userId },
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
  assertEntryType(input.entryType);
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
      source: PlanItemSource.MANUAL,
      entryType: input.entryType,
      title,
      childId,
      date: input.date,
      startsAt,
      endsAt,
      dueAt,
      dueHasTime: input.dueHasTime === true && dueAt != null,
      locationText: normalizeText(input.locationText, LOCATION_MAX, "location"),
      notes: normalizeText(input.notes, NOTES_MAX, "notes"),
    },
    select: calendarItemSelect,
  });
}

export async function updateManualPlanEntry(
  owner: PlanOwner,
  planItemId: string,
  patch: ManualPlanEntryPatch,
) {
  const current = await prisma.planItem.findFirst({
    where: {
      id: planItemId,
      userId: owner.userId,
      source: PlanItemSource.MANUAL,
      cancelledAt: null,
    },
    select: calendarItemSelect,
  });
  if (!current) throw new ManualPlanEntryError("NOT_FOUND", "manual_item_not_found");

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

  return prisma.planItem.update({
    where: { id: current.id },
    data: {
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
    },
    select: calendarItemSelect,
  });
}

export async function cancelManualPlanEntry(owner: PlanOwner, planItemId: string): Promise<void> {
  const result = await prisma.planItem.updateMany({
    where: { id: planItemId, userId: owner.userId, source: PlanItemSource.MANUAL },
    data: { cancelledAt: new Date() },
  });
  if (result.count === 0) throw new ManualPlanEntryError("NOT_FOUND", "manual_item_not_found");
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
    where: { userId: input.owner.userId, cancelledAt: null, date: { gte: from, lte: to } },
    select: calendarItemSelect,
    orderBy: [
      { date: "asc" },
      { startsAt: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
  });
  return rows.map(toFamilyCalendarItemDto);
}

export function toFamilyCalendarItemDto(row: CalendarRow): FamilyCalendarItemDto {
  const presentation = row.activity ? buildPlanCardPresentation(row.activity) : null;
  return {
    id: row.id,
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

import type { PlanEntryType, PlanItemSource } from "@prisma/client";

export type FamilyCalendarFilter = "all" | "family" | `child:${string}`;

export type FamilyCalendarPresentationInput = {
  id: string;
  source: PlanItemSource;
  entryType: PlanEntryType | null;
  title: string | null;
  childId: string | null;
  childName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  effectiveStartsAt: string | null;
  locationText: string | null;
  activityId: string | null;
  activity: {
    title: string;
    categoryLabel?: string | null;
    venueName?: string | null;
    venueAddress?: string | null;
  } | null;
};

export type FamilyCalendarItemPresentation = {
  title: string;
  typeLabel: string;
  personLabel: string;
  locationLabel: string | null;
  isCatalog: boolean;
  canEdit: boolean;
};

const TYPE_LABELS: Record<PlanEntryType, string> = {
  EVENT: "Событие",
  ACTIVITY: "Занятие",
  TASK: "Дело",
};

export function buildFamilyCalendarItemPresentation(
  item: FamilyCalendarPresentationInput,
): FamilyCalendarItemPresentation {
  const isCatalog = item.source === "CATALOG";
  const catalogLocation = item.activity?.venueName ?? item.activity?.venueAddress ?? null;
  return {
    title: item.activity?.title ?? item.title?.trim() ?? "Запись календаря",
    typeLabel: isCatalog
      ? (item.activity?.categoryLabel ?? "Активность")
      : item.source === "TELEGRAM_FORWARD"
        ? "Из Telegram"
        : item.entryType ? TYPE_LABELS[item.entryType] : "Запись",
    personLabel: item.childId ? (item.childName ?? "Ребёнок") : "Семья",
    locationLabel: isCatalog ? catalogLocation : item.locationText,
    isCatalog,
    canEdit: item.source === "MANUAL",
  };
}

export function filterFamilyCalendarItems<T extends { childId: string | null }>(
  items: readonly T[],
  filter: FamilyCalendarFilter,
): T[] {
  if (filter === "all") return [...items];
  if (filter === "family") return items.filter((item) => item.childId == null);
  const childId = filter.slice("child:".length);
  return items.filter((item) => item.childId === childId);
}

export type TimedCalendarItem = {
  id: string;
  date: string;
  childId: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export function findFamilyCalendarConflictIds(items: readonly TimedCalendarItem[]): Set<string> {
  const conflicts = new Set<string>();
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    const left = items[leftIndex]!;
    if (!left.startsAt || !left.endsAt) continue;
    const leftStart = Date.parse(left.startsAt);
    const leftEnd = Date.parse(left.endsAt);
    if (!Number.isFinite(leftStart) || !Number.isFinite(leftEnd)) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const right = items[rightIndex]!;
      if (left.date !== right.date || left.childId !== right.childId || !right.startsAt || !right.endsAt) continue;
      const rightStart = Date.parse(right.startsAt);
      const rightEnd = Date.parse(right.endsAt);
      if (leftStart < rightEnd && rightStart < leftEnd) {
        conflicts.add(left.id);
        conflicts.add(right.id);
      }
    }
  }
  return conflicts;
}

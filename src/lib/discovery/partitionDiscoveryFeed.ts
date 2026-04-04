import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import type { ActivityMock } from "@/mocks/activity.types";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

function ageRangeFromGroupId(id: string): { min: number; max: number } | null {
  const g = AGE_GROUPS.find((x) => x.value === id);
  if (!g) return null;
  return { min: g.min, max: g.max ?? 18 };
}

function activityOverlapsAgeRanges(
  a: ActivityMock,
  ranges: Array<{ min: number; max: number }>,
): boolean {
  const actMin = a.ageFrom ?? 0;
  const actMax = a.ageTo ?? 99;
  return ranges.some((r) => r.min <= actMax && r.max >= actMin);
}

function sortByEngagementThenStable(list: ActivityMock[]): ActivityMock[] {
  return [...list].sort((a, b) => {
    const d = (b.engagementScore ?? 0) - (a.engagementScore ?? 0);
    if (d !== 0) return d;
    return 0;
  });
}

function buildAgeHintBadge(
  a: ActivityMock,
  ranges: Array<{ min: number; max: number }>,
): string {
  const actMin = a.ageFrom ?? 0;
  const actMax = a.ageTo ?? 99;
  const sorted = [...ranges].sort((x, y) => x.min - y.min);
  const firstMin = sorted[0]!.min;
  const lastMax = sorted[sorted.length - 1]!.max;

  if (actMax < firstMin) return "Для малышей";
  if (actMin > lastMax) return "Для детей постарше";
  return "Вне выбранного возраста";
}

const SECONDARY_MAX = 12;
/** Минимум «сигналов», чтобы показать карточку во втором слое (не шум). */
/** Один сильный сигнал (save/plan) или несколько просмотров карточки. */
const MIN_ENGAGEMENT_FOR_SECONDARY = 2;

export type DiscoveryFeedPartition = {
  primary: ActivityMock[];
  secondary: ActivityMock[];
  secondaryHeading: string | null;
};

/**
 * Персонально подходящие по возрасту — выше; несовпадения с заметным engagement — второй блок.
 * При отсутствии фильтра по возрасту весь список в primary, сортировка по engagement.
 */
export function partitionDiscoveryFeed(
  filters: DiscoveryFilters,
  activities: ActivityMock[],
): DiscoveryFeedPartition {
  if (!filters.age.length) {
    return {
      primary: sortByEngagementThenStable(activities),
      secondary: [],
      secondaryHeading: null,
    };
  }

  const ranges = filters.age
    .map(ageRangeFromGroupId)
    .filter((r): r is { min: number; max: number } => r !== null);
  if (!ranges.length) {
    return {
      primary: sortByEngagementThenStable(activities),
      secondary: [],
      secondaryHeading: null,
    };
  }

  const matched: ActivityMock[] = [];
  const mismatched: ActivityMock[] = [];

  for (const a of activities) {
    if (activityOverlapsAgeRanges(a, ranges)) matched.push(a);
    else mismatched.push(a);
  }

  if (matched.length === 0) {
    return {
      primary: sortByEngagementThenStable(activities),
      secondary: [],
      secondaryHeading: null,
    };
  }

  const primary = sortByEngagementThenStable(matched);

  const secondaryCandidates = sortByEngagementThenStable(mismatched).filter(
    (a) => (a.engagementScore ?? 0) >= MIN_ENGAGEMENT_FOR_SECONDARY,
  );

  const secondary = secondaryCandidates.slice(0, SECONDARY_MAX).map((a) => ({
    ...a,
    ageHintBadge: buildAgeHintBadge(a, ranges),
  }));

  return {
    primary,
    secondary,
    secondaryHeading:
      secondary.length > 0 ? "Популярное у других семей" : null,
  };
}

/** @deprecated Используйте {@link partitionDiscoveryFeed} */
export function filterMockActivitiesByDiscovery(
  filters: DiscoveryFilters,
  activities: ActivityMock[],
): ActivityMock[] {
  return partitionDiscoveryFeed(filters, activities).primary;
}

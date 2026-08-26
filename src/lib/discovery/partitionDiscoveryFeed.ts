import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import type { ActivityMock } from "@/types/activity";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";

function ageRangeFromGroupId(id: string): { min: number; max: number } | null {
  const g = AGE_GROUPS.find((x) => x.value === id);
  if (!g) return null;
  /** 18+ и др. без верхней границы — как у карточек с ageTo 99 в ленте */
  return { min: g.min, max: g.max ?? 99 };
}

function activityOverlapsAgeRanges(
  a: ActivityMock,
  ranges: Array<{ min: number; max: number }>,
): boolean {
  const actMin = a.ageFrom ?? 0;
  const actMax = a.ageTo ?? 99;
  return ranges.some((r) => r.min <= actMax && r.max >= actMin);
}

/**
 * AgePolicy is authoritative where it carries stronger semantics than the
 * card's numeric fallback. In particular UNRESTRICTED means “Любой возраст”
 * and must match both children and adults even when legacy card bounds fall
 * back to 0–12.
 */
function activityMatchesAgeContext(
  activity: ActivityMock,
  ranges: Array<{ min: number; max: number }>,
): boolean {
  if (activity.agePolicy === "UNRESTRICTED") return true;
  return activityOverlapsAgeRanges(activity, ranges);
}

function sortByEngagementThenStable(list: ActivityMock[]): ActivityMock[] {
  return [...list].sort((a, b) => {
    const d = (b.engagementScore ?? 0) - (a.engagementScore ?? 0);
    if (d !== 0) return d;
    return 0;
  });
}

function activityMatchesFormat(
  activity: ActivityMock,
  format: "OFFLINE" | "ONLINE" | "HYBRID" | null,
): boolean {
  if (!format) return true;
  return (activity.format ?? "OFFLINE") === format;
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
/**
 * Второй слой действительно должен быть популярным: 4 балла = как минимум
 * один SAVE по текущей canonical шкале либо несколько пассивных действий.
 * Одиночный DETAIL_OPEN больше не достаточен, чтобы называться «популярным».
 */
const MIN_ENGAGEMENT_FOR_SECONDARY = 4;

export type DiscoveryFeedPartition = {
  primary: ActivityMock[];
  secondary: ActivityMock[];
  secondaryHeading: string | null;
};

/**
 * Глобальный контекст «Для кого» задаёт основной слой выдачи.
 * Несовместимый по возрасту контент никогда не подмешивается обратно в
 * primary как fallback; если он действительно популярен, он может попасть
 * только в явно отделённый блок «Популярное у других семей».
 */
export function partitionDiscoveryFeed(
  filters: DiscoveryFilters,
  activities: ActivityMock[],
): DiscoveryFeedPartition {
  const hasChildAgeContext = filters.age.some((age) => age !== "18+");
  const eligibleActivities = hasChildAgeContext
    ? activities.filter((activity) => activity.agePolicy !== "ADULT_ONLY")
    : activities;
  const formatFiltered = eligibleActivities.filter((activity) =>
    activityMatchesFormat(activity, filters.format),
  );

  if (!filters.age.length) {
    return {
      primary: sortByEngagementThenStable(formatFiltered),
      secondary: [],
      secondaryHeading: null,
    };
  }

  const ranges = filters.age
    .map(ageRangeFromGroupId)
    .filter((r): r is { min: number; max: number } => r !== null);
  if (!ranges.length) {
    return {
      primary: sortByEngagementThenStable(formatFiltered),
      secondary: [],
      secondaryHeading: null,
    };
  }

  const matched: ActivityMock[] = [];
  const mismatched: ActivityMock[] = [];

  for (const activity of formatFiltered) {
    if (activityMatchesAgeContext(activity, ranges)) matched.push(activity);
    else mismatched.push(activity);
  }

  const primary = sortByEngagementThenStable(matched);
  const secondaryCandidates = sortByEngagementThenStable(mismatched).filter(
    (activity) => (activity.engagementScore ?? 0) >= MIN_ENGAGEMENT_FOR_SECONDARY,
  );

  const secondary = secondaryCandidates.slice(0, SECONDARY_MAX).map((activity) => ({
    ...activity,
    ageHintBadge: buildAgeHintBadge(activity, ranges),
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

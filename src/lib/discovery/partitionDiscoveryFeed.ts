import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import type { ActivityMock } from "@/types/activity";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import {
  matchesAdultSelfAudience,
  matchesChildAgeRanges,
} from "@/lib/discovery/audienceEligibility";

function ageRangeFromGroupId(id: string): { min: number; max: number } | null {
  const g = AGE_GROUPS.find((x) => x.value === id);
  if (!g) return null;
  /** 18+ и др. без верхней границы — как у карточек с ageTo 99 в ленте */
  return { min: g.min, max: g.max ?? 99 };
}

function sortByEngagementThenStable(list: ActivityMock[]): ActivityMock[] {
  return [...list].sort((a, b) => {
    const d = (b.engagementScore ?? 0) - (a.engagementScore ?? 0);
    if (d !== 0) return d;
    return 0;
  });
}

/** Explicit audience matches outrank merely unrestricted content. */
function sortByAudienceRelevance(
  list: ActivityMock[],
  ranges: Array<{ min: number; max: number }>,
  adultSelfContext: boolean,
): ActivityMock[] {
  return [...list].sort((a, b) => {
    const aExplicitMatch =
      a.agePolicy !== "UNRESTRICTED" &&
      (adultSelfContext
        ? matchesAdultSelfAudience(a)
        : matchesChildAgeRanges(a, ranges));
    const bExplicitMatch =
      b.agePolicy !== "UNRESTRICTED" &&
      (adultSelfContext
        ? matchesAdultSelfAudience(b)
        : matchesChildAgeRanges(b, ranges));

    const aRelevance = aExplicitMatch ? 2 : a.agePolicy === "UNRESTRICTED" ? 1 : 0;
    const bRelevance = bExplicitMatch ? 2 : b.agePolicy === "UNRESTRICTED" ? 1 : 0;

    if (aRelevance !== bRelevance) return bRelevance - aRelevance;
    return (b.engagementScore ?? 0) - (a.engagementScore ?? 0);
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
 * Глобальный контекст «Для кого» задаёт eligibility основного слоя выдачи.
 *
 * - только "Я" (age=["18+"]) = adult self-context, а не обычное пересечение
 *   диапазонов: детские/подростковые диапазоны, заканчивающиеся на 18, не
 *   проходят;
 * - если выбран хотя бы один ребёнок, 18+ взрослого-сопровождающего не
 *   расширяет выдачу, а событие должно подходить всем выбранным детским
 *   возрастным диапазонам;
 * - несовместимый детский контент не показываем вторым слоем в self-context.
 */
export function partitionDiscoveryFeed(
  filters: DiscoveryFilters,
  activities: ActivityMock[],
): DiscoveryFeedPartition {
  const childAgeIds = filters.age.filter((age) => age !== "18+");
  const hasChildAgeContext = childAgeIds.length > 0;
  const adultSelfContext =
    filters.age.length > 0 &&
    !hasChildAgeContext &&
    filters.age.every((age) => age === "18+");

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

  const effectiveAgeIds = hasChildAgeContext ? childAgeIds : filters.age;
  const ranges = effectiveAgeIds
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
    const matches = adultSelfContext
      ? matchesAdultSelfAudience(activity)
      : matchesChildAgeRanges(activity, ranges);

    if (matches) matched.push(activity);
    else mismatched.push(activity);
  }

  const primary = sortByAudienceRelevance(matched, ranges, adultSelfContext);

  if (adultSelfContext) {
    return {
      primary,
      secondary: [],
      secondaryHeading: null,
    };
  }

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

import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import type { ActivityMock } from "@/types/activity";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import {
  matchesManualAgeRanges,
  matchesSelectedPersonaAudience,
  type AgeRange,
  type AudienceSelection,
} from "@/lib/discovery/audienceEligibility";

function ageRangeFromGroupId(id: string): (AgeRange & { id: string }) | null {
  const g = AGE_GROUPS.find((x) => x.value === id);
  if (!g) return null;
  /** 18+ и др. без верхней границы — как у карточек с ageTo 99 в ленте */
  return { id, min: g.min, max: g.max ?? 99 };
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
  ranges: AgeRange[],
): string {
  if (ranges.length === 0) return "Вне выбранного возраста";

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

function hasResolvedPersonaSelection(
  audience: AudienceSelection | undefined,
): audience is AudienceSelection {
  if (!audience || audience.selectedPersonaIds.length === 0) return false;
  return audience.personas.some((persona) =>
    audience.selectedPersonaIds.includes(persona.id),
  );
}

/**
 * Глобальный контекст «Для кого» задаёт eligibility основного слоя выдачи.
 *
 * Если реально выбраны персоны, используем их как source of truth:
 * - только "Я" = adult self-context;
 * - "Я + ребёнок" = пригодность для ребёнка, взрослый сопровождает;
 * - несколько детей = пригодность для каждого выбранного ребёнка.
 *
 * Если персон нет (свободный/ручной поиск), age chips сохраняют обычную OR
 * семантику multi-select. Так ручной выбор 3–5 + 9–12 не превращается в AND.
 */
export function partitionDiscoveryFeed(
  filters: DiscoveryFilters,
  activities: ActivityMock[],
  audience?: AudienceSelection,
): DiscoveryFeedPartition {
  const formatFiltered = activities.filter((activity) =>
    activityMatchesFormat(activity, filters.format),
  );

  const personaDriven = hasResolvedPersonaSelection(audience);
  const ranges = filters.age
    .map(ageRangeFromGroupId)
    .filter((r): r is AgeRange & { id: string } => r !== null);

  if (!personaDriven && ranges.length === 0) {
    return {
      primary: sortByEngagementThenStable(formatFiltered),
      secondary: [],
      secondaryHeading: null,
    };
  }

  const matched: ActivityMock[] = [];
  const mismatched: ActivityMock[] = [];

  for (const activity of formatFiltered) {
    const matches = personaDriven
      ? matchesSelectedPersonaAudience(activity, audience)
      : matchesManualAgeRanges(activity, ranges);

    if (matches) matched.push(activity);
    else mismatched.push(activity);
  }

  const primary = sortByEngagementThenStable(matched);

  const selectedPersonas = personaDriven
    ? audience.personas.filter((persona) =>
        audience.selectedPersonaIds.includes(persona.id),
      )
    : [];
  const selfOnly =
    selectedPersonas.length > 0 &&
    selectedPersonas.every((persona) => persona.kind === "adult");

  // В self-контексте детский контент не возвращаем вторичным блоком.
  if (selfOnly) {
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

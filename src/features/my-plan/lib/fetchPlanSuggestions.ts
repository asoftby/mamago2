import type { PlanItemWithActivity } from "../types/event";
import type { MyPlanIdea } from "../hooks/useMyPlan";

export type RecommendationAttribution = {
  recommendationRunId?: string | null;
  recommendationExposureId?: string | null;
  recommendationPosition?: number | null;
  recommendationAlgorithmVersion?: string | null;
};

export type PlanSuggestionItem = NonNullable<MyPlanIdea["activity"]> &
  RecommendationAttribution;

/**
 * GET /api/plan/suggestions — реальный контент (Activity, type=EVENT), не клиентский demo-пул.
 * Параметры передаются явно вызывающим кодом (не через реактивный стор), чтобы не зависеть
 * от отстающего на кадр состояния — тот же принцип, что уже применён для setSelectedPersonaIds.
 */
export async function fetchPlanSuggestions(params: {
  citySlug: string;
  date: string;
  excludeActivityIds: string[];
  ageRangeValues: string[];
  personaIds?: string[];
}): Promise<PlanSuggestionItem[]> {
  const qs = new URLSearchParams();
  qs.set("city", params.citySlug);
  qs.set("date", params.date);
  if (params.excludeActivityIds.length > 0) {
    qs.set("exclude", params.excludeActivityIds.join(","));
  }
  if (params.ageRangeValues.length > 0) {
    qs.set("ageRanges", params.ageRangeValues.join(","));
  }
  if ((params.personaIds?.length ?? 0) > 0) {
    qs.set("personaIds", params.personaIds!.join(","));
  }
  const res = await fetch(`/api/plan/suggestions?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`plan suggestions request failed: ${res.status}`);
  }
  const data = (await res.json()) as { suggestions?: PlanSuggestionItem[] };
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

/** Оборачивает сырой Activity-саджест в PlanItemWithActivity для RecommendationCard. Без слота/времени — API их не отдаёт. */
export function mapSuggestionToPlanItem(
  activity: PlanSuggestionItem,
  dateIso: string,
): PlanItemWithActivity {
  return {
    id: `suggestion-${activity.id}`,
    userId: "me",
    activityId: activity.id,
    date: dateIso,
    startsAt: null,
    title: activity.title,
    coverImageUrl: activity.coverImageUrl,
    createdAt: new Date(),
    activity,
  };
}

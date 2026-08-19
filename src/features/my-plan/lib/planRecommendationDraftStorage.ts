import type { PlanSuggestionItem } from "./fetchPlanSuggestions";

export const PLAN_RECOMMENDATION_DRAFT_STORAGE_KEY =
  "mamago:planRecommendationDrafts:v1";

export interface PlanRecommendationDraft {
  suggestions: PlanSuggestionItem[];
  batchNumber: number;
  addedActivityIds: string[];
  shownActivityIds: string[];
  ageRangeValues: string[];
  lastSuccessfulFetchAt: string | null;
}

export function reconcileAddedActivityIds(
  localIds: string[],
  serverIds: Iterable<string>,
  serverSnapshotConfirmed: boolean,
): string[] {
  if (!serverSnapshotConfirmed) return localIds;
  const confirmed = new Set(serverIds);
  return localIds.filter((id) => confirmed.has(id));
}

interface PersistedDraftsV1 {
  v: 1;
  selectedDate: string | null;
  drafts: Record<string, PlanRecommendationDraft>;
}

const EMPTY: PersistedDraftsV1 = { v: 1, selectedDate: null, drafts: {} };

export function recommendationDraftKey(input: {
  citySlug: string;
  date: string;
  audienceIds: string[];
}): string {
  return [input.citySlug, input.date, input.audienceIds.slice().sort().join(",") || "free"].join("|");
}

function isDraft(value: unknown): value is PlanRecommendationDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<PlanRecommendationDraft>;
  return (
    Array.isArray(draft.suggestions) &&
    draft.suggestions.every((item) => item && typeof item === "object" && typeof item.id === "string") &&
    typeof draft.batchNumber === "number" &&
    Number.isInteger(draft.batchNumber) &&
    draft.batchNumber >= 0 &&
    Array.isArray(draft.addedActivityIds) &&
    draft.addedActivityIds.every((id) => typeof id === "string") &&
    Array.isArray(draft.shownActivityIds) &&
    draft.shownActivityIds.every((id) => typeof id === "string") &&
    Array.isArray(draft.ageRangeValues) &&
    draft.ageRangeValues.every((id) => typeof id === "string") &&
    (draft.lastSuccessfulFetchAt === null || typeof draft.lastSuccessfulFetchAt === "string")
  );
}

export function parseRecommendationDrafts(raw: string | null): PersistedDraftsV1 {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedDraftsV1>;
    if (parsed.v !== 1 || !parsed.drafts || typeof parsed.drafts !== "object") return EMPTY;
    const drafts: Record<string, PlanRecommendationDraft> = {};
    for (const [key, value] of Object.entries(parsed.drafts)) {
      if (isDraft(value)) drafts[key] = value;
    }
    return {
      v: 1,
      selectedDate: typeof parsed.selectedDate === "string" ? parsed.selectedDate : null,
      drafts,
    };
  } catch {
    return EMPTY;
  }
}

export function loadRecommendationDraft(key: string): PlanRecommendationDraft | null {
  if (typeof window === "undefined") return null;
  try {
    return parseRecommendationDrafts(
      window.localStorage.getItem(PLAN_RECOMMENDATION_DRAFT_STORAGE_KEY),
    ).drafts[key] ?? null;
  } catch {
    return null;
  }
}

export function loadPersistedPlanDate(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return parseRecommendationDrafts(
      window.localStorage.getItem(PLAN_RECOMMENDATION_DRAFT_STORAGE_KEY),
    ).selectedDate;
  } catch {
    return null;
  }
}

export function persistSelectedPlanDate(selectedDate: string): void {
  if (typeof window === "undefined") return;
  try {
    const current = parseRecommendationDrafts(
      window.localStorage.getItem(PLAN_RECOMMENDATION_DRAFT_STORAGE_KEY),
    );
    window.localStorage.setItem(
      PLAN_RECOMMENDATION_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...current, selectedDate }),
    );
  } catch {
    // localStorage can be unavailable in private mode or over quota.
  }
}

export function persistRecommendationDraft(
  key: string,
  draft: PlanRecommendationDraft | null,
  selectedDate: string,
): void {
  if (typeof window === "undefined") return;
  try {
    const current = parseRecommendationDrafts(
      window.localStorage.getItem(PLAN_RECOMMENDATION_DRAFT_STORAGE_KEY),
    );
    const drafts = { ...current.drafts };
    if (draft) drafts[key] = draft;
    else delete drafts[key];
    window.localStorage.setItem(
      PLAN_RECOMMENDATION_DRAFT_STORAGE_KEY,
      JSON.stringify({ v: 1, selectedDate, drafts } satisfies PersistedDraftsV1),
    );
  } catch {
    // localStorage can be unavailable in private mode or over quota.
  }
}

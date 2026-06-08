import type { PlanOnboardingSignalChip } from "@/lib/signals/signalUsageType";

export const MAX_MINI_ONBOARDING_PREFERENCES = 3;
export const MINI_ONBOARDING_SIGNALS_LIMIT = 12;

export const MINI_ONBOARDING_DISMISS_SESSION_PREFIX =
  "mamago:planMiniAdultPrefsDismissed:";

/** Fallback, если API Signals недоступен — UI не остаётся пустым. */
export const FALLBACK_PLAN_PREFERENCE_SIGNALS: PlanOnboardingSignalChip[] = [
  { id: "fallback-pref-coffee", slug: "plan-pref-coffee", title: "Кофе", order: 1, icon: null },
  { id: "fallback-pref-walks", slug: "plan-pref-walks", title: "Прогулки", order: 2, icon: null },
  { id: "fallback-pref-scenic", slug: "plan-pref-scenic", title: "Красивые места", order: 3, icon: null },
  { id: "fallback-pref-calm", slug: "plan-pref-calm", title: "Спокойно", order: 4, icon: null },
  { id: "fallback-pref-active", slug: "plan-pref-active", title: "Активно", order: 5, icon: null },
  { id: "fallback-pref-culture", slug: "plan-pref-culture", title: "Культура", order: 6, icon: null },
  { id: "fallback-pref-creative", slug: "plan-pref-creative", title: "Творчество", order: 7, icon: null },
  { id: "fallback-pref-food", slug: "plan-pref-food", title: "Еда", order: 8, icon: null },
];

export const FALLBACK_PLAN_FORMAT_SIGNALS: PlanOnboardingSignalChip[] = [
  { id: "fallback-format-outdoor", slug: "plan-format-outdoor", title: "На улице", order: 1, icon: null },
  { id: "fallback-format-indoor", slug: "plan-format-indoor", title: "В помещении", order: 2, icon: null },
  { id: "fallback-format-mixed", slug: "plan-format-mixed", title: "Смешанный", order: 3, icon: null },
  { id: "fallback-format-home", slug: "plan-format-home", title: "Дома", order: 4, icon: null },
];

export type AdultPersonaSignal = PlanOnboardingSignalChip;

export function hasAdultSelectionPreferences(persona: {
  preferenceSignalIds?: string[];
  leisureFormatSignalId?: string | null;
}): boolean {
  return (
    (persona.preferenceSignalIds?.length ?? 0) > 0 ||
    !!persona.leisureFormatSignalId
  );
}

export function mergeSignalCatalog(
  primary: PlanOnboardingSignalChip[],
  resolved: PlanOnboardingSignalChip[],
): PlanOnboardingSignalChip[] {
  const map = new Map<string, PlanOnboardingSignalChip>();
  for (const signal of primary) {
    map.set(signal.id, signal);
  }
  for (const signal of resolved) {
    map.set(signal.id, signal);
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
}

export function resolveSelectedPlanPersonalization(params: {
  preferenceSignalIds: string[];
  leisureFormatSignalId: string | null;
  catalog: PlanOnboardingSignalChip[];
}): {
  selectedPreferences: PlanOnboardingSignalChip[];
  selectedFormat: PlanOnboardingSignalChip | null;
} {
  const byId = new Map(params.catalog.map((signal) => [signal.id, signal]));

  const selectedPreferences = params.preferenceSignalIds
    .map((id) => byId.get(id))
    .filter((signal): signal is PlanOnboardingSignalChip => signal != null);

  const selectedFormat = params.leisureFormatSignalId
    ? byId.get(params.leisureFormatSignalId) ?? null
    : null;

  return { selectedPreferences, selectedFormat };
}

export function isFallbackSignalId(id: string): boolean {
  return id.startsWith("fallback-");
}

/** Оставляет только id предпочтений, исключая формат и неизвестные signals. */
export function sanitizePreferenceSignalIds(
  ids: string[],
  preferenceSignals: PlanOnboardingSignalChip[],
  formatSignals: PlanOnboardingSignalChip[] = [],
): string[] {
  const preferenceIds = new Set(preferenceSignals.map((signal) => signal.id));
  const formatIds = new Set(formatSignals.map((signal) => signal.id));

  const seen = new Set<string>();
  const result: string[] = [];

  for (const id of ids) {
    if (!id || formatIds.has(id) || !preferenceIds.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_MINI_ONBOARDING_PREFERENCES) {
      break;
    }
  }

  return result;
}

export function sanitizeLeisureFormatSignalId(
  id: string | null | undefined,
  formatSignals: PlanOnboardingSignalChip[],
): string | null {
  if (!id) return null;
  return formatSignals.some((signal) => signal.id === id) ? id : null;
}

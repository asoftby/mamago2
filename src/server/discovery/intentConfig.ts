export type IntentType = "go" | "classes" | "birthday";

export const INTENT_CONFIG: Record<IntentType, string[]> = {
  go: ["when", "age", "district", "metro"],
  classes: ["when", "age", "district", "metro", "price", "schedule"],
  birthday: ["when", "age", "district", "metro", "price"],
};

export const INTENT_FILTERS = INTENT_CONFIG;

export const DEFAULT_INTENT = "go";

export function getFiltersForIntent(intent: string): string[] {
  if (intent in INTENT_CONFIG) {
    return INTENT_CONFIG[intent as IntentType];
  }
  return INTENT_CONFIG[DEFAULT_INTENT as IntentType];
}

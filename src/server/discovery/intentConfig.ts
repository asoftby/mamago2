export type IntentType = "go" | "classes" | "birthday";

export const INTENT_CONFIG: Record<IntentType, string[]> = {
  go: ["when", "age", "district", "metro"],
  classes: ["when", "age", "district", "metro", "price", "schedule"],
  birthday: ["when", "age", "district", "metro", "price", "vibe"],
};

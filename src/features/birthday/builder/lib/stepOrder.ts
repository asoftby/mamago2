import type { BuilderStep } from "../types/builder";

/** Полный порядок шагов конструктора (совпадает с навигацией в useBirthdayBuilder) */
export const BUILDER_STEP_ORDER: BuilderStep[] = [
  "intro",
  "theme",
  "budget",
  "extras",
  "place",
  "entertainment",
  "food",
  "decor",
  "summary",
  "confirm",
];

export const TOTAL_BUILDER_STEPS = BUILDER_STEP_ORDER.length;

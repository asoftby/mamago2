import type { BuilderStep } from "../types/builder";

/** Полный порядок шагов конструктора */
export const BUILDER_STEP_ORDER: BuilderStep[] = [
  "when",
  "who",
  "format",
  "pick",
  "done",
];

export const TOTAL_BUILDER_STEPS = BUILDER_STEP_ORDER.length;

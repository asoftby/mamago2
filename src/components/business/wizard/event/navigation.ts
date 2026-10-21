import type { Role } from "@prisma/client";
import { canFreelyNavigateWizard } from "../shared/canFreelyNavigateWizard";
import type { EventFormData } from "./types";
import { validateStep, type EventValidationContext } from "./validation";

export interface EventStepNavigationResult {
  canContinue: boolean;
  issues: string[];
}

/**
 * Staff can freely move between steps. Other editors get actionable feedback
 * from the same step validation that previously disabled the Continue button.
 * Publication and draft validation are deliberately unchanged.
 */
export function evaluateEventStepNavigation({
  role,
  step,
  data,
  context,
  isLoadingGenres,
}: {
  role?: Role | null;
  step: number;
  data: EventFormData;
  context: EventValidationContext;
  isLoadingGenres: boolean;
}): EventStepNavigationResult {
  if (canFreelyNavigateWizard(role)) {
    return { canContinue: true, issues: [] };
  }
  if (isLoadingGenres) {
    return { canContinue: false, issues: ["Дождитесь загрузки жанров"] };
  }
  const validation = validateStep(step, data, context);
  if (validation.isComplete) {
    return { canContinue: true, issues: [] };
  }
  const issues = [...new Set([...validation.errors, ...validation.warnings].filter(Boolean))];
  return {
    canContinue: false,
    issues: issues.length ? issues : ["Заполните обязательные поля этого шага"],
  };
}

export function formatEventStepNavigationIssues(issues: string[]): string | undefined {
  if (issues.length === 0) return undefined;
  return issues.length > 3
    ? `${issues.slice(0, 3).join(" · ")} · ещё ${issues.length - 3}`
    : issues.join(" · ");
}

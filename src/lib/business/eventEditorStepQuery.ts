import {
  EVENT_WIZARD_STEPS,
  TOTAL_CONTENT_STEPS,
} from "@/components/business/wizard/event/eventWizardSteps.config";

const TOTAL_INCLUDING_REVIEW = TOTAL_CONTENT_STEPS + 1;

/**
 * Число (1…N) или ключ шага (`basics`, `media`, `review` …) из query `?step=`.
 */
export function parseEventEditorStepQuery(q: string | null): number | null {
  if (q == null || !String(q).trim()) return null;
  const trimmed = String(q).trim();
  const n = parseInt(trimmed, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= TOTAL_INCLUDING_REVIEW) {
    return n;
  }
  const lower = trimmed.toLowerCase();
  const found = EVENT_WIZARD_STEPS.find((s) => s.key === lower);
  if (found) return found.id;
  if (lower === "review" || lower === "check" || lower === "final") {
    return TOTAL_INCLUDING_REVIEW;
  }
  return null;
}

export function totalEventWizardStepsIncludingReview(): number {
  return TOTAL_INCLUDING_REVIEW;
}

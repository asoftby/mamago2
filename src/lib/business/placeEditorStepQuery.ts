import {
  getPlaceWizardSteps,
  getPlaceWizardTotalSteps,
} from "@/components/business/wizard/place/config";

/**
 * Число (1…N) или ключ шага из query `?step=` для редактора места.
 */
export function parsePlaceEditorStepQuery(
  q: string | null,
  ctaStepEnabled = false,
): number | null {
  const wizardSteps = getPlaceWizardSteps(ctaStepEnabled);
  const totalSteps = getPlaceWizardTotalSteps(ctaStepEnabled);

  if (q == null || !String(q).trim()) return null;
  const trimmed = String(q).trim();
  const n = parseInt(trimmed, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= totalSteps) {
    return n;
  }
  const lower = trimmed.toLowerCase();
  const found = wizardSteps.find((s) => s.key === lower);
  if (found) return found.id;
  if (lower === "review" || lower === "check" || lower === "final") {
    return totalSteps;
  }
  return null;
}

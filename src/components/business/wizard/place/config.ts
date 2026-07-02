/**
 * Wizard configuration
 * Single source of truth for step structure
 */

const LEGACY_WIZARD_STEPS = [
  { id: 1, key: "profile", label: "Профиль" },
  { id: 2, key: "location", label: "Локация" },
  { id: 3, key: "contacts", label: "Контакты" },
  { id: 4, key: "photos", label: "Фото" },
  { id: 5, key: "openingHours", label: "Режим работы" },
  { id: 6, key: "faq", label: "Вопросы" },
  { id: 7, key: "review", label: "Проверка" },
] as const;

const CTA_WIZARD_STEPS = [
  { id: 1, key: "profile", label: "Профиль" },
  { id: 2, key: "location", label: "Локация" },
  { id: 3, key: "contacts", label: "Контакты" },
  { id: 4, key: "photos", label: "Фото" },
  { id: 5, key: "openingHours", label: "Режим работы" },
  { id: 6, key: "cta", label: "Как воспользоваться" },
  { id: 7, key: "faq", label: "Вопросы" },
  { id: 8, key: "review", label: "Проверка" },
] as const;

export type WizardStepKey =
  | typeof LEGACY_WIZARD_STEPS[number]["key"]
  | typeof CTA_WIZARD_STEPS[number]["key"];

export function getPlaceWizardSteps(ctaStepEnabled = false) {
  return ctaStepEnabled ? CTA_WIZARD_STEPS : LEGACY_WIZARD_STEPS;
}

export function getPlaceWizardTotalSteps(ctaStepEnabled = false): number {
  return getPlaceWizardSteps(ctaStepEnabled).length;
}

export function isPlaceReviewStep(step: number, ctaStepEnabled = false): boolean {
  return getStepKey(step, ctaStepEnabled) === "review";
}

/**
 * Get step label by step number
 */
export function getStepLabel(step: number, ctaStepEnabled = false): string {
  const stepConfig = getPlaceWizardSteps(ctaStepEnabled).find((s) => s.id === step);
  return stepConfig?.label || "";
}

/**
 * Get step key by step number
 */
export function getStepKey(
  step: number,
  ctaStepEnabled = false,
): WizardStepKey | null {
  const stepConfig = getPlaceWizardSteps(ctaStepEnabled).find((s) => s.id === step);
  return stepConfig?.key || null;
}

/**
 * Categories for Step 1
 */
export const PLACE_CATEGORIES = [
  { value: "cafe", label: "Кафе и рестораны" },
  { value: "museum", label: "Музеи" },
  { value: "park", label: "Парки и площадки" },
  { value: "kids-center", label: "Детские центры" },
  { value: "theater", label: "Театры" },
  { value: "sport", label: "Спортивные объекты" },
  { value: "entertainment", label: "Развлечения" },
  { value: "education", label: "Образование" },
  { value: "other", label: "Другое" },
] as const;

/**
 * Visit formats for Step 1
 */
export const VISIT_FORMATS = ["indoor", "outdoor", "online"] as const;

/**
 * Activity types for Step 1
 */
export const ACTIVITY_TYPES = ["sports", "arts", "education", "entertainment", "food"] as const;

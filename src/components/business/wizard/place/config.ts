/**
 * Wizard configuration
 * Single source of truth for step structure
 */

export const WIZARD_STEPS = [
  { id: 1, key: "profile", label: "Профиль" },
  { id: 2, key: "location", label: "Локация" },
  { id: 3, key: "contacts", label: "Контакты" },
  { id: 4, key: "photos", label: "Фото" },
  { id: 5, key: "openingHours", label: "Режим работы" },
  { id: 6, key: "review", label: "Проверка" },
] as const;

export const TOTAL_STEPS = WIZARD_STEPS.length;

export type WizardStepKey = typeof WIZARD_STEPS[number]["key"];

/**
 * Get step label by step number
 */
export function getStepLabel(step: number): string {
  const stepConfig = WIZARD_STEPS.find(s => s.id === step);
  return stepConfig?.label || "";
}

/**
 * Get step key by step number
 */
export function getStepKey(step: number): WizardStepKey | null {
  const stepConfig = WIZARD_STEPS.find(s => s.id === step);
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

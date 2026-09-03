/**
 * Place Wizard configuration.
 *
 * This module is the canonical, component-free source of truth for semantic
 * step identity, order and copy. UI step configs, navigation and review
 * surfaces must derive their numeric positions from this registry instead of
 * maintaining their own step arrays.
 */

export const PLACE_WIZARD_STEP_DEFINITIONS = {
  profile: {
    shortLabel: "О месте",
    title: "О месте",
    description: "Расскажите главное о вашем месте",
  },
  location: {
    shortLabel: "Локация",
    title: "Локация",
    description: "Укажите адрес — район и метро определим автоматически",
  },
  contacts: {
    shortLabel: "Контакты",
    title: "Контакты",
    description: "Как с вами связаться",
  },
  photos: {
    shortLabel: "Фото",
    title: "Фотографии",
    description: "Покажите ваше место",
  },
  openingHours: {
    shortLabel: "Режим работы",
    title: "Режим работы",
    description: "Когда вы работаете",
  },
  cta: {
    shortLabel: "Как воспользоваться",
    title: "Как воспользоваться",
    description: "Настройте основной способ взаимодействия для пользователя",
  },
  faq: {
    shortLabel: "Вопросы",
    title: "Частые вопросы",
    description: "Необязательный блок с ответами на частые вопросы родителей",
  },
  review: {
    shortLabel: "Проверка",
    title: "Проверка и отправка",
    description: "Финальная проверка изменений",
  },
} as const;

export type WizardStepKey = keyof typeof PLACE_WIZARD_STEP_DEFINITIONS;

export interface PlaceWizardStepDefinition {
  id: number;
  key: WizardStepKey;
  /** Backward-compatible alias used by the existing progress UI. */
  label: string;
  shortLabel: string;
  title: string;
  description: string;
}

const PLACE_WIZARD_CORE_STEP_KEYS: readonly WizardStepKey[] = [
  "profile",
  "location",
  "contacts",
  "photos",
  "openingHours",
];

/**
 * Semantic sequence for the active wizard layout.
 *
 * Numeric ids are deliberately materialized only after this sequence is
 * resolved. This keeps optional steps from becoming a second source of truth.
 */
export function getPlaceWizardStepKeys(ctaStepEnabled = false): WizardStepKey[] {
  return [
    ...PLACE_WIZARD_CORE_STEP_KEYS,
    ...(ctaStepEnabled ? (["cta"] as const) : []),
    "faq",
    "review",
  ];
}

export function getPlaceWizardSteps(
  ctaStepEnabled = false,
): PlaceWizardStepDefinition[] {
  return getPlaceWizardStepKeys(ctaStepEnabled).map((key, index) => {
    const definition = PLACE_WIZARD_STEP_DEFINITIONS[key];
    return {
      id: index + 1,
      key,
      label: definition.shortLabel,
      shortLabel: definition.shortLabel,
      title: definition.title,
      description: definition.description,
    };
  });
}

export function getPlaceWizardTotalSteps(ctaStepEnabled = false): number {
  return getPlaceWizardStepKeys(ctaStepEnabled).length;
}

export function getPlaceWizardStepNumber(
  key: WizardStepKey,
  ctaStepEnabled = false,
): number | null {
  const index = getPlaceWizardStepKeys(ctaStepEnabled).indexOf(key);
  return index === -1 ? null : index + 1;
}

export function isPlaceReviewStep(step: number, ctaStepEnabled = false): boolean {
  return getStepKey(step, ctaStepEnabled) === "review";
}

/** Get step label by its current numeric position. */
export function getStepLabel(step: number, ctaStepEnabled = false): string {
  const stepConfig = getPlaceWizardSteps(ctaStepEnabled).find((s) => s.id === step);
  return stepConfig?.label || "";
}

/** Get semantic step key by its current numeric position. */
export function getStepKey(
  step: number,
  ctaStepEnabled = false,
): WizardStepKey | null {
  return getPlaceWizardStepKeys(ctaStepEnabled)[step - 1] ?? null;
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

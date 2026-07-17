// Config-driven step definitions for Place Wizard

import { WizardStepConfig, SummaryItem, buildReviewSections } from "../shared/types";
import type { PlaceFormData } from "./types";
import { sortAgeKeys } from "@/lib/config/ages";

// Re-export buildReviewSections for convenience
export { buildReviewSections };

// Import step components
import { Step1Profile } from "./steps/Step1Profile";
import { Step2Location } from "./steps/Step2Location";
import { Step3Contacts } from "./steps/Step3Contacts";
import { Step4Photos } from "./steps/Step4Photos";
import { Step5OpeningHours } from "./steps/Step5OpeningHours";
import { StepCta } from "./steps/StepCta";
import { FaqStep } from "../shared/FaqStep";
import { deriveCtaStepState } from "../shared/CtaStep";
import { mapPlaceFormDataToCtaStepValue } from "./ctaStepMapper";

/**
 * Place Wizard Steps Configuration
 */
const PLACE_WIZARD_BASE_STEPS: WizardStepConfig<PlaceFormData>[] = [
  // Step 1: Profile
  {
    id: 1,
    key: "profile",
    shortLabel: "Профиль",
    title: "Профиль места",
    description: "Основная информация о вашем месте",
    component: Step1Profile,
    
    isComplete: (data) => !!(
      data.title?.trim() &&
      data.shortDesc?.trim() &&
      data.description?.trim() &&
      data.category &&
      // ageTags is always "complete": either a specific selection, or an
      // empty array representing the deliberate "Любой возраст" choice.
      data.visitFormats?.length > 0
    ),
    
    getSummary: (data) => [
      {
        label: "Название",
        value: data.title || <span className="text-red-500">Не указано</span>,
        isMissing: !data.title,
      },
      {
        label: "Категория",
        value: data.category || "Не выбрана",
      },
      {
        label: "Краткое описание",
        value: data.shortDesc ? `${data.shortDesc.length} символов` : "Не указано",
      },
      {
        label: "Возраст",
        value: data.ageTags?.length > 0
          ? sortAgeKeys(data.ageTags).join(", ")
          : "Любой возраст",
      },
    ],
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.title?.trim()) missing.push("Название места");
      if (!data.shortDesc?.trim()) missing.push("Краткое описание");
      if (!data.description?.trim()) missing.push("Полное описание");
      if (!data.category) missing.push("Категория");
      if (!data.visitFormats?.length) missing.push("Формат посещения");
      return missing;
    },
  },

  // Step 2: Location
  {
    id: 2,
    key: "location",
    shortLabel: "Место",
    title: "Локация",
    description: "Где находится ваше место",
    component: Step2Location,
    
    isComplete: (data) => !!(
      data.formattedAddr?.trim() &&
      data.lat !== null &&
      data.lng !== null
    ),
    
    getSummary: (data) => [
      {
        label: "Адрес",
        value: data.formattedAddr || <span className="text-red-500">Не указан</span>,
        isMissing: !data.formattedAddr,
      },
      {
        label: "Координаты",
        value: data.lat && data.lng ? "Указаны" : "Не указаны",
      },
      {
        label: "Район",
        value: data.displayDistrictName || "Не определен",
      },
      {
        label: "Метро",
        value: data.displayMetroName || "Не указано",
      },
    ],
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.formattedAddr?.trim()) missing.push("Адрес");
      if (!data.lat || !data.lng) missing.push("Координаты на карте");
      return missing;
    },
  },

  // Step 3: Contacts
  {
    id: 3,
    key: "contacts",
    shortLabel: "Контакты",
    title: "Контакты",
    description: "Как с вами связаться",
    component: Step3Contacts,
    
    isComplete: (data) => true, // Optional step
    
    getSummary: (data) => [
      {
        label: "Телефон",
        value: data.phone || "Не указан",
      },
      {
        label: "Сайт",
        value: data.website || "Не указан",
      },
      {
        label: "Instagram",
        value: data.instagramHandle ? `@${data.instagramHandle}` : "Не указан",
      },
    ],
    
    getMissingFields: (data) => [], // Optional step
  },

  // Step 4: Photos
  {
    id: 4,
    key: "photos",
    shortLabel: "Фото",
    title: "Фотографии",
    description: "Покажите ваше место",
    component: Step4Photos,
    
    isComplete: (data) => data.images?.length > 0,
    
    getSummary: (data) => [
      {
        label: "Логотип",
        value: data.logoUrl || data.images?.find(img => img.kind === "LOGO") ? "Загружен" : "Не загружен",
      },
      {
        label: "Фотографии",
        value: data.images?.filter(img => img.kind === "GALLERY")?.length > 0 
          ? `${data.images.filter(img => img.kind === "GALLERY").length} фото`
          : <span className="text-red-500">Не загружены</span>,
        isMissing: !data.images?.filter(img => img.kind === "GALLERY")?.length,
      },
    ],
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.images?.filter(img => img.kind === "GALLERY")?.length) {
        missing.push("Фотографии места");
      }
      return missing;
    },
  },

  // Step 5: Opening Hours
  {
    id: 5,
    key: "openingHours",
    shortLabel: "Часы",
    title: "Режим работы",
    description: "Когда вы работаете",
    component: Step5OpeningHours,
    
    isComplete: (data) => true, // Optional step
    
    getSummary: (data) => [
      {
        label: "Режим работы",
        value: data.openingHoursData?.mode === "ALWAYS_OPEN" ? "Круглосуточно" :
               data.openingHoursData?.mode === "BY_APPOINTMENT" ? "По записи" :
               data.openingHoursData?.mode === "TEMPORARILY_CLOSED" ? "Временно закрыто" :
               data.openingHoursData?.mode === "WEEKLY" ? "По расписанию" :
               "Не указан",
      },
    ],
    
    getMissingFields: (data) => [], // Optional step
  },
];

function createPlaceCtaSummary(data: PlaceFormData): SummaryItem[] {
  const sourceEntityId = data.id ?? "place-wizard-draft";
  const ctaStepValue = mapPlaceFormDataToCtaStepValue(data, { id: sourceEntityId });
  const derived = deriveCtaStepState(
    {
      sourceEntityType: "PLACE",
      sourceEntityId,
    },
    ctaStepValue,
  );
  const fallbackParts = [
    ctaStepValue.fallback.phone?.trim() ? "телефон" : null,
    ctaStepValue.fallback.website?.trim() ? "сайт" : null,
  ].filter(Boolean);

  return [
    {
      label: "Основное действие",
      value: derived.canonicalCta.primaryLabel,
    },
    {
      label: "Сценарий",
      value: derived.userFacingSummary,
    },
    {
      label: "Fallback",
      value: fallbackParts.length > 0 ? fallbackParts.join(", ") : "Не добавлен",
    },
  ];
}

function createPlaceCtaStep(id: number): WizardStepConfig<PlaceFormData> {
  return {
    id,
    key: "cta",
    shortLabel: "CTA",
    title: "Как воспользоваться",
    description: "Настройте основной способ взаимодействия для пользователя",
    component: StepCta,
    isComplete: () => true,
    getSummary: (data) => createPlaceCtaSummary(data),
    getMissingFields: () => [],
  };
}

function createPlaceFaqStep(id: number): WizardStepConfig<PlaceFormData> {
  return {
    id,
    key: "faq",
    shortLabel: "Вопросы",
    title: "Частые вопросы",
    description: "Необязательный блок с ответами на частые вопросы родителей",
    component: ({ data, onChange, isEditable: _isEditable }) => (
      <FaqStep
        kind="place"
        value={data.faqItems}
        onChange={(faqItems) => onChange({ faqItems })}
      />
    ),
    isComplete: () => true,
    getSummary: (data) => [
      {
        label: "Вопросы",
        value: data.faqItems.length > 0 ? `${data.faqItems.length} вопросов` : "Не добавлен",
      },
    ],
    getMissingFields: () => [],
  };
}

export const PLACE_WIZARD_STEPS: WizardStepConfig<PlaceFormData>[] = [
  ...PLACE_WIZARD_BASE_STEPS,
  createPlaceFaqStep(6),
];

export function getPlaceWizardStepConfigs(
  ctaStepEnabled = false,
): WizardStepConfig<PlaceFormData>[] {
  if (!ctaStepEnabled) {
    return PLACE_WIZARD_STEPS;
  }

  return [
    ...PLACE_WIZARD_BASE_STEPS,
    createPlaceCtaStep(6),
    createPlaceFaqStep(7),
  ];
}

export const TOTAL_CONTENT_STEPS = PLACE_WIZARD_STEPS.length;

/**
 * Get step label by step number
 */
export function getStepLabel(step: number): string {
  const stepConfig = PLACE_WIZARD_STEPS.find(s => s.id === step);
  return stepConfig?.title || "";
}

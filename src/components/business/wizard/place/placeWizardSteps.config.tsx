// Config-driven behavioral definitions for Place Wizard steps.
// Semantic identity, ordering and copy live in ./config.ts.

import { AgePolicy } from "@prisma/client";
import { WizardStepConfig, SummaryItem, buildReviewSections } from "../shared/types";
import type { PlaceFormData } from "./types";
import { sortAgeKeys } from "@/lib/config/ages";
import {
  getPlaceWizardSteps,
  type PlaceWizardStepDefinition,
} from "./config";
import { isPlaceAgeSelectionComplete } from "./isPlaceAgeChipActive";

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

type PlaceStepBehavior = Omit<
  WizardStepConfig<PlaceFormData>,
  "id" | "key" | "shortLabel" | "title" | "description"
>;

function withRegistryMetadata(
  step: PlaceWizardStepDefinition,
  behavior: PlaceStepBehavior,
): WizardStepConfig<PlaceFormData> {
  return {
    id: step.id,
    key: step.key,
    shortLabel: step.shortLabel,
    title: step.title,
    description: step.description,
    ...behavior,
  };
}

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

function getPlaceAgeSummary(data: PlaceFormData): string {
  switch (data.agePolicy) {
    case AgePolicy.UNRESTRICTED:
      return "Любой возраст";
    case AgePolicy.ADULT_ONLY:
      return "Только 18+";
    case AgePolicy.SPECIFIC:
      return data.ageTags.length > 0 ? sortAgeKeys(data.ageTags).join(", ") : "Не указан";
    case AgePolicy.UNKNOWN:
    default:
      return "Не указан";
  }
}

function createPlaceStepConfig(
  step: PlaceWizardStepDefinition,
): WizardStepConfig<PlaceFormData> | null {
  switch (step.key) {
    case "profile":
      return withRegistryMetadata(step, {
        component: Step1Profile,
        isComplete: (data) => !!(
          data.title?.trim() &&
          data.shortDesc?.trim() &&
          data.description?.trim() &&
          data.category &&
          isPlaceAgeSelectionComplete({ agePolicy: data.agePolicy, ageTags: data.ageTags }) &&
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
            value: getPlaceAgeSummary(data),
            isMissing: !isPlaceAgeSelectionComplete({
              agePolicy: data.agePolicy,
              ageTags: data.ageTags,
            }),
          },
        ],
        getMissingFields: (data) => {
          const missing: string[] = [];
          if (!data.title?.trim()) missing.push("Название места");
          if (!data.shortDesc?.trim()) missing.push("Краткое описание");
          if (!data.description?.trim()) missing.push("Полное описание");
          if (!data.category) missing.push("Категория");
          if (!isPlaceAgeSelectionComplete({ agePolicy: data.agePolicy, ageTags: data.ageTags })) {
            missing.push("Возраст");
          }
          if (!data.visitFormats?.length) missing.push("Формат посещения");
          return missing;
        },
      });

    case "location":
      return withRegistryMetadata(step, {
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
      });

    case "contacts":
      return withRegistryMetadata(step, {
        component: Step3Contacts,
        isComplete: () => true,
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
        getMissingFields: () => [],
      });

    case "photos":
      return withRegistryMetadata(step, {
        component: Step4Photos,
        isComplete: (data) => data.images?.length > 0,
        getSummary: (data) => [
          {
            label: "Логотип",
            value: data.logoUrl || data.images?.find((img) => img.kind === "LOGO")
              ? "Загружен"
              : "Не загружен",
          },
          {
            label: "Фотографии",
            value: data.images?.filter((img) => img.kind === "GALLERY")?.length > 0
              ? `${data.images.filter((img) => img.kind === "GALLERY").length} фото`
              : <span className="text-red-500">Не загружены</span>,
            isMissing: !data.images?.filter((img) => img.kind === "GALLERY")?.length,
          },
        ],
        getMissingFields: (data) => {
          const missing: string[] = [];
          if (!data.images?.filter((img) => img.kind === "GALLERY")?.length) {
            missing.push("Фотографии места");
          }
          return missing;
        },
      });

    case "openingHours":
      return withRegistryMetadata(step, {
        component: Step5OpeningHours,
        isComplete: () => true,
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
        getMissingFields: () => [],
      });

    case "cta":
      return withRegistryMetadata(step, {
        component: StepCta,
        isComplete: () => true,
        getSummary: (data) => createPlaceCtaSummary(data),
        getMissingFields: () => [],
      });

    case "faq":
      return withRegistryMetadata(step, {
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
      });

    case "review":
      return null;
  }
}

/**
 * Behavioral content-step configs derived from the canonical semantic registry.
 * Review is rendered by StepReview itself and is intentionally excluded here.
 */
export function getPlaceWizardStepConfigs(
  ctaStepEnabled = false,
): WizardStepConfig<PlaceFormData>[] {
  return getPlaceWizardSteps(ctaStepEnabled).flatMap((step) => {
    const config = createPlaceStepConfig(step);
    return config ? [config] : [];
  });
}

/** Backward-compatible legacy layout export. */
export const PLACE_WIZARD_STEPS: WizardStepConfig<PlaceFormData>[] =
  getPlaceWizardStepConfigs(false);

export const TOTAL_CONTENT_STEPS = PLACE_WIZARD_STEPS.length;

/**
 * Backward-compatible title lookup for legacy consumers.
 */
export function getStepLabel(step: number): string {
  const stepConfig = PLACE_WIZARD_STEPS.find((item) => item.id === step);
  return stepConfig?.title || "";
}

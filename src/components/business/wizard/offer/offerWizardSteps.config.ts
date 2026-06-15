/**
 * Offer Wizard Steps Configuration by Type
 * 
 * Defines step sequences for different offer types:
 * - SINGLE: Разовое занятие
 * - REGULAR: Регулярные занятия
 * - CAMP: Лагерь / смена
 */

import type { ReviewSection } from "../shared/types";
import type { OfferWizardType, OfferWizardStepKey, OfferFormData } from "./types";
import { validatePublicationAccess } from "@/features/publication-access";
import { showCampLodgingFormFields } from "./campOfferModel";
import { isOfferContactsComplete } from "./contacts";

export interface OfferWizardStepDef {
  key: OfferWizardStepKey;
  title: string;
  description: string;
  shortLabel: string;
}

/** Все возможные ключи шагов мастера (для нормализации данных из БД/localStorage). */
export const ALL_OFFER_WIZARD_STEP_KEYS: OfferWizardStepKey[] = [
  "type",
  "details",
  "photo",
  "conditions",
  "campSchedule",
  "accommodation",
  "price",
  "contacts",
  "review",
];

/** Отфильтровать сырое значение (БД/localStorage) до валидных ключей шагов. */
export function normalizeWizardCompletedSteps(raw: unknown): OfferWizardStepKey[] {
  if (!Array.isArray(raw)) return [];
  return ALL_OFFER_WIZARD_STEP_KEYS.filter((key) => raw.includes(key));
}

/**
 * Legacy export for backward compatibility
 * Maps to getStepsForOfferType
 */
export const OFFER_WIZARD_STEPS: OfferWizardStepDef[] = [];

/**
 * Legacy export for backward compatibility
 */
export const TOTAL_CONTENT_STEPS = 0;

/**
 * Legacy export for backward compatibility
 */
export function getStepLabel(stepId: number): string {
  return `Шаг ${stepId}`;
}

/**
 * Legacy export for backward compatibility
 */
export function buildReviewSections(_data: OfferFormData): ReviewSection[] {
  void _data;
  return [];
}

/**
 * Step definitions for each offer type
 * Returns array of steps in order, with proper numbering
 */
export function getStepsForOfferType(type: OfferWizardType | null): OfferWizardStepDef[] {
  if (!type) return [];

  const priceStepTitle = type === "CAMP" ? "Участие" : "Цена";
  const priceStepDescription =
    type === "CAMP"
      ? "Способ участия и условия получения"
      : "Стоимость, способ участия и условия получения";
  const priceStepShortLabel = type === "CAMP" ? "Участие" : "Цена";

  const baseSteps: Record<OfferWizardStepKey, Omit<OfferWizardStepDef, "key">> = {
    type: {
      title: "Тип предложения",
      description: "Что предлагается пользователям?",
      shortLabel: "Тип",
    },
    details: {
      title: "Детали",
      description: "Основная информация о предложении",
      shortLabel: "Детали",
    },
    photo: {
      title: "Фото и видео",
      description: "Главное изображение, галерея и видео",
      shortLabel: "Фото",
    },
    conditions: {
      title: "Условия",
      description: "Формат и условия предложения",
      shortLabel: "Условия",
    },
    campSchedule: {
      title: "Смены и расписание",
      description: "Укажите даты, формат пребывания и расписание смены",
      shortLabel: "Смены",
    },
    accommodation: {
      title: "Размещение",
      description: "Расскажите о бытовых условиях, питании и трансфере",
      shortLabel: "Размещение",
    },
    price: {
      title: priceStepTitle,
      description: priceStepDescription,
      shortLabel: priceStepShortLabel,
    },
    contacts: {
      title: "Контакты",
      description: "Адрес, телефоны, сайт и социальные сети",
      shortLabel: "Контакты",
    },
    review: {
      title: "Проверка",
      description: "Проверка и отправка на модерацию",
      shortLabel: "Проверка",
    },
  };

  let stepKeys: OfferWizardStepKey[] = [];

  if (type === "SINGLE" || type === "REGULAR") {
    // SINGLE and REGULAR have the same step sequence
    stepKeys = [
      "type",
      "details",
      "photo",
      "conditions",
      "price",
      "contacts",
      "review",
    ];
  } else if (type === "CAMP") {
    // CAMP has additional steps for schedule and accommodation
    stepKeys = [
      "type",
      "details",
      "photo",
      "campSchedule",
      "accommodation",
      "price",
      "contacts",
      "review",
    ];
  }

  return stepKeys.map((key) => ({
    key,
    ...baseSteps[key],
  }));
}

/**
 * Get step number (1-indexed) for a given step key within a specific offer type
 * Returns null if step doesn't exist for this type
 */
export function getStepNumber(
  type: OfferWizardType | null,
  stepKey: OfferWizardStepKey
): number | null {
  const steps = getStepsForOfferType(type);
  const index = steps.findIndex((s) => s.key === stepKey);
  return index >= 0 ? index + 1 : null;
}

/**
 * Get total number of steps for a given offer type (including review)
 */
export function getTotalStepsForType(type: OfferWizardType | null): number {
  return getStepsForOfferType(type).length;
}

/**
 * Get step definition by key for a given offer type
 */
export function getStepDefByKey(
  type: OfferWizardType | null,
  stepKey: OfferWizardStepKey
): OfferWizardStepDef | null {
  const steps = getStepsForOfferType(type);
  return steps.find((s) => s.key === stepKey) || null;
}

/**
 * Check if a step should be shown for a given offer type
 */
export function shouldShowStep(
  type: OfferWizardType | null,
  stepKey: OfferWizardStepKey
): boolean {
  return getStepNumber(type, stepKey) !== null;
}

/**
 * Get next step key for a given offer type and current step
 */
export function getNextStepKey(
  type: OfferWizardType | null,
  currentStepKey: OfferWizardStepKey
): OfferWizardStepKey | null {
  const steps = getStepsForOfferType(type);
  const currentIndex = steps.findIndex((s) => s.key === currentStepKey);
  if (currentIndex >= 0 && currentIndex < steps.length - 1) {
    return steps[currentIndex + 1].key;
  }
  return null;
}

/**
 * Get previous step key for a given offer type and current step
 */
export function getPreviousStepKey(
  type: OfferWizardType | null,
  currentStepKey: OfferWizardStepKey
): OfferWizardStepKey | null {
  const steps = getStepsForOfferType(type);
  const currentIndex = steps.findIndex((s) => s.key === currentStepKey);
  if (currentIndex > 0) {
    return steps[currentIndex - 1].key;
  }
  return null;
}

/**
 * Check if step is complete based on form data
 */
export function isStepComplete(
  stepKey: OfferWizardStepKey,
  data: OfferFormData
): boolean {
  switch (stepKey) {
    case "type":
      return !!data.offerWizardType;

    case "details":
      if (data.offerWizardType === "CAMP") {
        return (
          data.title.trim().length >= 3 &&
          data.shortDescription.trim().length >= 10 &&
          !!data.campProgramType
        );
      }
      return (
        data.title.trim().length >= 3 &&
        data.shortDescription.trim().length >= 10
      );

    case "photo":
      return !!data.coverImage;

    case "conditions":
      // For SINGLE/REGULAR
      if (data.offerWizardType === "SINGLE" || data.offerWizardType === "REGULAR") {
        return !!(data.classDuration.trim() && data.classFormat);
      }
      return true;

    case "campSchedule":
      // For CAMP
      if (data.offerWizardType === "CAMP") {
        const dated = data.campSessions.filter((s) => s.dateFrom && s.dateTo);
        if (dated.length === 0) return false;
        return !dated.some(
          (s) => s.dateFrom && s.dateTo && s.dateFrom > s.dateTo,
        );
      }
      return true;

    case "accommodation":
      if (data.offerWizardType !== "CAMP") return true;
      if (!showCampLodgingFormFields(data)) return true;
      return Boolean(
        data.accommodationType &&
        data.accommodationAddress?.trim(),
      );

    case "price":
      {
        const hasValidPricing =
          data.offerWizardType === "CAMP"
            ? true
            : !!data.pricingMode &&
              (data.pricingMode === "single"
                ? !!data.singlePrice.trim()
                : data.pricingOptions.length > 0 &&
                  data.pricingOptions.every((opt) => opt.title.trim() && opt.price.trim()));

        if (!hasValidPricing) return false;

        if (data.publicationAccess) {
          return validatePublicationAccess(data.publicationAccess).valid;
        }

        if (!data.ctaType) return false;
        if (data.ctaType === "записаться" || data.ctaType === "отправить_заявку") {
          return !!(data.ctaPhone && data.ctaPhone.trim());
        }
        if (data.ctaType === "перейти_на_сайт" || data.ctaType === "купить_билет") {
          return !!(data.ctaLink && data.ctaLink.trim());
        }
        if (data.ctaType === "забронировать") {
          const booking = data.bookingSettings;
          if (!booking.mode) return false;
          if (booking.mode === "request") {
            return !!(
              booking.selectionType &&
              booking.availableDaysAhead &&
              booking.availableDaysAhead > 0 &&
              booking.capacityPerUnit &&
              booking.capacityPerUnit > 0
            );
          }
          if (booking.mode === "slot") {
            const hasValidSchedule = booking.weeklyAvailability.some(
              (day) => day.enabled && day.startTime && day.endTime
            );
            return !!(
              booking.availableDaysAhead &&
              booking.availableDaysAhead > 0 &&
              booking.slotDurationMinutes &&
              booking.slotDurationMinutes >= 15 &&
              booking.capacityPerUnit &&
              booking.capacityPerUnit > 0 &&
              hasValidSchedule
            );
          }
          if (booking.mode === "external") {
            return !!(booking.externalUrl && booking.externalUrl.trim());
          }
        }
        return true;
      }

    case "contacts":
      return isOfferContactsComplete(data);

    case "review":
      // Review step is complete when all previous steps are complete
      return true;

    default:
      return false;
  }
}

/**
 * Get missing fields for a step
 */
export function getMissingFieldsForStep(
  stepKey: OfferWizardStepKey,
  data: OfferFormData
): string[] {
  const missing: string[] = [];

  switch (stepKey) {
    case "type":
      if (!data.offerWizardType) missing.push("Тип предложения");
      break;

    case "details":
      if (!data.title || data.title.trim().length < 3) missing.push("Название");
      if (!data.shortDescription || data.shortDescription.trim().length < 10)
        missing.push("Описание");
      if (data.offerWizardType === "CAMP" && !data.campProgramType) {
        missing.push("Тип программы лагеря");
      }
      break;

    case "photo":
      if (!data.coverImage) missing.push("Главное изображение");
      break;

    case "conditions":
      if (data.offerWizardType === "SINGLE" || data.offerWizardType === "REGULAR") {
        if (!data.classDuration.trim()) missing.push("Продолжительность занятия");
        if (!data.classFormat) missing.push("Формат занятия");
      }
      break;

    case "campSchedule":
      if (data.offerWizardType === "CAMP") {
        const dated = data.campSessions.filter((s) => s.dateFrom && s.dateTo);
        if (dated.length === 0) {
          missing.push("Смены с датами");
        } else if (
          dated.some((s) => s.dateFrom && s.dateTo && s.dateFrom > s.dateTo)
        ) {
          missing.push("Корректный интервал дат смены");
        }
      }
      break;

    case "accommodation":
      if (data.offerWizardType === "CAMP" && showCampLodgingFormFields(data)) {
        if (!data.accommodationType) missing.push("Тип размещения");
        if (!data.accommodationAddress?.trim()) missing.push("Адрес проживания");
      }
      break;

    case "contacts":
      if (data.contactSource === "place") {
        if (!data.placeId) missing.push("Место для контактов");
      }
      break;

    case "price":
      if (data.offerWizardType !== "CAMP") {
        if (!data.pricingMode) {
          missing.push("Режим ценообразования");
        } else if (data.pricingMode === "single" && !data.singlePrice.trim()) {
          missing.push("Цена");
        } else if (data.pricingMode === "multiple" && data.pricingOptions.length === 0) {
          missing.push("Варианты цен");
        }
      }
      if (data.publicationAccess) {
        const validation = validatePublicationAccess(data.publicationAccess);
        missing.push(...Object.values(validation.errors));
      } else if (!data.ctaType) {
        missing.push("Тип действия");
      } else {
        if (
          (data.ctaType === "записаться" || data.ctaType === "отправить_заявку") &&
          !data.ctaPhone
        ) {
          missing.push("Телефон для связи");
        }
        if (
          (data.ctaType === "перейти_на_сайт" || data.ctaType === "купить_билет") &&
          !data.ctaLink
        ) {
          missing.push("Ссылка");
        }
      }
      break;
  }

  return missing;
}

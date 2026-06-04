// Offer Wizard Steps Configuration (MVP)
// Simplified 5-step wizard

import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { WizardStepConfig, SummaryItem } from "../shared/types";
import type { OfferFormDataMVP } from "./types.mvp";

// Import MVP step components
import { Step1TypeMVP } from "./steps/Step1TypeMVP";
import { Step2InformationMVP } from "./steps/Step2InformationMVP";
import { Step3SignalsMVP } from "./steps/Step3SignalsMVP";
import { Step4PriceAndCTAMVP } from "./steps/Step4PriceAndCTAMVP";
import { Step5MediaMVP } from "./steps/Step5MediaMVP";

/**
 * MVP Offer Wizard Steps Configuration
 * 5 steps for 2-3 minute creation flow
 */
export const OFFER_WIZARD_STEPS_MVP: WizardStepConfig<OfferFormDataMVP>[] = [
  // Step 1: Offer Type
  {
    id: 1,
    key: "type",
    shortLabel: "Тип",
    title: "Тип предложения",
    description: "Что вы предлагаете?",
    component: Step1TypeMVP,
    
    isComplete: (data) => Boolean(data.offerKind),
    
    getSummary: (data) => {
      const kindLabels = {
        course: "Курс / Занятия",
        birthday: "Детский праздник",
        service: "Услуга",
      };
      
      return [
        {
          label: "Тип",
          value: data.offerKind
            ? kindLabels[data.offerKind]
            : <span className="text-red-500">Не выбран</span>,
          isMissing: !data.offerKind,
        },
      ];
    },
    
    getMissingFields: (data) => {
      return data.offerKind ? [] : ["Тип предложения"];
    },
  },
  
  // Step 2: Basic Information
  {
    id: 2,
    key: "information",
    shortLabel: "Детали",
    title: "Основная информация",
    description: "Название, описание и место",
    component: Step2InformationMVP,
    
    isComplete: (data) => {
      return Boolean(
        data.title.trim().length >= 3 &&
        data.description.trim().length >= 20 &&
        data.placeId
      );
    },
    
    getSummary: (data) => [
      {
        label: "Название",
        value: data.title || <span className="text-red-500">Не указано</span>,
        isMissing: !data.title,
      },
      {
        label: "Описание",
        value: data.description
          ? `${data.description.slice(0, 80)}${data.description.length > 80 ? "..." : ""}`
          : <span className="text-red-500">Не указано</span>,
        isMissing: !data.description,
      },
      {
        label: "Место",
        value: data.placeId
          ? <span className="text-green-600">Выбрано</span>
          : <span className="text-red-500">Не выбрано</span>,
        isMissing: !data.placeId,
      },
    ],
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.title || data.title.trim().length < 3) missing.push("Название");
      if (!data.description || data.description.trim().length < 20) missing.push("Описание");
      if (!data.placeId) missing.push("Место");
      return missing;
    },
  },
  
  // Step 3: Audience and Signals
  {
    id: 3,
    key: "signals",
    shortLabel: "Для кого",
    title: "Для кого и как",
    description: "Возраст и характеристики",
    component: Step3SignalsMVP,
    
    isComplete: (data) => {
      return Boolean(
        data.ageMinMonths !== null &&
        data.ageMaxMonths !== null &&
        data.activitySignals.length >= 1 &&
        data.activitySignals.length <= 3 &&
        data.formatSignals.length >= 1 &&
        data.formatSignals.length <= 2 &&
        data.participationSignals.length === 1
      );
    },
    
    getSummary: (data) => {
      const items: SummaryItem[] = [];
      
      // Age
      if (data.ageMinMonths !== null && data.ageMaxMonths !== null) {
        items.push({
          label: "Возраст",
          value: `${monthsToYears(data.ageMinMonths)} - ${monthsToYears(data.ageMaxMonths)}`,
        });
      } else {
        items.push({
          label: "Возраст",
          value: <span className="text-red-500">Не указан</span>,
          isMissing: true,
        });
      }
      
      // Signals
      items.push(
        {
          label: "Активность",
          value: data.activitySignals.length > 0
            ? `${data.activitySignals.length} выбрано`
            : <span className="text-red-500">Не выбрано</span>,
          isMissing: data.activitySignals.length === 0,
        },
        {
          label: "Формат",
          value: data.formatSignals.length > 0
            ? `${data.formatSignals.length} выбрано`
            : <span className="text-red-500">Не выбрано</span>,
          isMissing: data.formatSignals.length === 0,
        },
        {
          label: "Участие",
          value: data.participationSignals.length === 1
            ? "Выбрано"
            : <span className="text-red-500">Не выбрано</span>,
          isMissing: data.participationSignals.length !== 1,
        }
      );
      
      // Optional signals
      if (data.intentionSignals.length > 0) {
        items.push({
          label: "Намерение",
          value: `${data.intentionSignals.length} выбрано`,
        });
      }
      
      if (data.featureSignals.length > 0) {
        items.push({
          label: "Особенности",
          value: `${data.featureSignals.length} выбрано`,
        });
      }
      
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (data.ageMinMonths === null) missing.push("Минимальный возраст");
      if (data.ageMaxMonths === null) missing.push("Максимальный возраст");
      if (data.activitySignals.length === 0) missing.push("Тип активности");
      if (data.formatSignals.length === 0) missing.push("Формат проведения");
      if (data.participationSignals.length === 0) missing.push("Тип участия");
      return missing;
    },
  },
  
  // Step 4: Price and CTA
  {
    id: 4,
    key: "price",
    shortLabel: "Цена",
    title: "Цена и запись",
    description: "Стоимость и способ связи",
    component: Step4PriceAndCTAMVP,
    
    isComplete: (data) => {
      if (!data.priceFrom || data.priceFrom <= 0) return false;
      if (!data.ctaType) return false;
      
      // Check contact based on CTA type
      const hasPhone = data.ctaPhone && data.ctaPhone.trim().length > 0;
      const hasLink = data.ctaLink && data.ctaLink.trim().length > 0;
      
      if (!hasPhone && !hasLink) return false;
      
      return true;
    },
    
    getSummary: (data) => {
      const ctaLabels: Record<string, string> = {
        записаться: "Записаться",
        забронировать: "Забронировать",
        купить_билет: "Купить билет",
        отправить_заявку: "Отправить заявку",
        перейти_на_сайт: "Перейти на сайт",
      };
      
      const items: SummaryItem[] = [
        {
          label: "Цена",
          value: data.priceFrom
            ? `от ${data.priceFrom} ${BYN_SYMBOL}${data.priceText ? ` (${data.priceText})` : ""}`
            : <span className="text-red-500">Не указана</span>,
          isMissing: !data.priceFrom,
        },
        {
          label: "Действие",
          value: data.ctaType
            ? ctaLabels[data.ctaType]
            : <span className="text-red-500">Не выбрано</span>,
          isMissing: !data.ctaType,
        },
      ];
      
      if (data.ctaPhone) {
        items.push({
          label: "Телефон",
          value: data.ctaPhone,
        });
      }
      
      if (data.ctaLink) {
        items.push({
          label: "Ссылка",
          value: "Указана",
        });
      }
      
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.priceFrom || data.priceFrom <= 0) missing.push("Цена");
      if (!data.ctaType) missing.push("Действие");
      
      const hasPhone = data.ctaPhone && data.ctaPhone.trim().length > 0;
      const hasLink = data.ctaLink && data.ctaLink.trim().length > 0;
      
      if (!hasPhone && !hasLink) missing.push("Телефон или ссылка");
      
      return missing;
    },
  },
  
  // Step 5: Media and Publication
  {
    id: 5,
    key: "media",
    shortLabel: "Фото",
    title: "Медиа и публикация",
    description: "Изображения для предложения",
    component: Step5MediaMVP,
    
    isComplete: (data) => {
      return Boolean(data.coverImage && data.gallery.length >= 1);
    },
    
    getSummary: (data) => [
      {
        label: "Обложка",
        value: data.coverImage
          ? <span className="text-green-600">Загружена</span>
          : <span className="text-red-500">Не загружена</span>,
        isMissing: !data.coverImage,
      },
      {
        label: "Галерея",
        value: data.gallery.length >= 1
          ? `${data.gallery.length} изображений`
          : <span className="text-red-500">Не добавлено</span>,
        isMissing: data.gallery.length === 0,
      },
    ],
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.coverImage) missing.push("Главное изображение");
      if (data.gallery.length === 0) missing.push("Галерея (минимум 1 фото)");
      return missing;
    },
  },
];

/**
 * Get step config by ID
 */
export function getStepConfigMVP(stepId: number): WizardStepConfig<OfferFormDataMVP> | undefined {
  return OFFER_WIZARD_STEPS_MVP.find((step) => step.id === stepId);
}

/**
 * Get step config by key
 */
export function getStepConfigByKeyMVP(key: string): WizardStepConfig<OfferFormDataMVP> | undefined {
  return OFFER_WIZARD_STEPS_MVP.find((step) => step.key === key);
}

/**
 * Get total number of content steps
 */
export const TOTAL_CONTENT_STEPS_MVP = OFFER_WIZARD_STEPS_MVP.length;

/**
 * Get step label
 */
export function getStepLabelMVP(stepId: number): string {
  const step = getStepConfigMVP(stepId);
  return step ? step.title : `Шаг ${stepId}`;
}

/**
 * Helper: Convert months to years label
 */
function monthsToYears(months: number): string {
  if (months < 12) return `${months} мес`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "год" : years <= 4 ? "года" : "лет"}`;
}

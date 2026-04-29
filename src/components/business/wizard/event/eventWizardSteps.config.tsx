// Event Wizard Steps Configuration
// Config-driven step definitions for Event Wizard

import { WizardStepConfig, SummaryItem, buildReviewSections } from "../shared/types";
import type { EventFormData } from "./types";
import { labelForEventFormats } from "@/lib/business/eventFormatSignals";
import { isRichTextMeaningful, getRichTextLength, createExcerpt } from "@/lib/richtext/utils";
import { formatPrice, formatPriceFrom } from "@/lib/formatters/format-price";

// Re-export buildReviewSections for convenience
export { buildReviewSections };

// Import step components
import { Step1Basics } from "./steps/Step1Basics";
import { Step2Location } from "./steps/Step2Location";
import { Step2Description } from "./steps/Step2Description";
import { Step3Media } from "./steps/Step3Media";
import { Step4DateTime } from "./steps/Step4DateTime";
import { Step5PricingParticipation } from "./steps/Step5PricingParticipation";
import { Step7Contacts } from "./steps/Step7Contacts";
import { Step8Organizer } from "./steps/Step8Organizer";

/**
 * Event Wizard Steps Configuration
 * Single source of truth for all steps
 */
export const EVENT_WIZARD_STEPS: WizardStepConfig<EventFormData>[] = [
  // Step 1: Basics
  {
    id: 1,
    key: "basics",
    shortLabel: "Основное",
    title: "Основная информация",
    description: "Название, формат события, категория и возраст",
    component: Step1Basics,
    
    isComplete: (data) => {
      const categoryOk =
        !!data.categoryId && (!data.primaryRootHasChildren || !!data.subcategoryId);
      return !!(
        data.title.trim().length >= 3 &&
        data.eventFormats.length > 0 &&
        categoryOk &&
        data.ageRangeIds.length > 0
      );
    },
    
    getSummary: (data) => {
      const hasPrimary =
        !!data.categoryId && (!data.primaryRootHasChildren || !!data.subcategoryId);

      const items: SummaryItem[] = [
        {
          label: "Название",
          value: data.title || <span className="text-red-500">Не указано</span>,
          isMissing: !data.title,
        },
        {
          label: "Как проходит событие",
          value: data.eventFormats.length > 0 ? (
            labelForEventFormats(data.eventFormats)
          ) : (
            <span className="text-yellow-600">Не выбран</span>
          ),
          isMissing: data.eventFormats.length === 0,
        },
        {
          label: "Категория",
          value: data.categoryPathLabel ? (
            data.categoryPathLabel
          ) : (
            <span className="text-red-500">Не выбрана</span>
          ),
          isMissing: !hasPrimary,
        },
        {
          label: "Возрастные группы",
          value: data.ageRangeIds.length > 0
            ? data.ageRangeIds.join(", ")
            : <span className="text-yellow-600">Не выбран</span>,
          isMissing: data.ageRangeIds.length === 0,
        },
      ];
      
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      const hasPrimary =
        !!data.categoryId && (!data.primaryRootHasChildren || !!data.subcategoryId);
      if (!data.title || data.title.trim().length < 3) missing.push("Название");
      if (data.eventFormats.length === 0) missing.push("Как проходит событие");
      if (!hasPrimary) missing.push("Категория");
      if (data.ageRangeIds.length === 0) missing.push("Возрастные группы");
      return missing;
    },
  },
  
  // Step 2: Location
  {
    id: 2,
    key: "location",
    shortLabel: "Место",
    title: "Локация",
    description: "Где проходит событие?",
    component: Step2Location,
    
    isComplete: (data) => {
      if (!data.venueKind) return false;
      if (data.venueKind === "PLACE") return !!data.placeId;
      if (data.venueKind === "MANUAL") {
        return Boolean(data.venueName && data.address && data.city);
      }
      return true; // MOBILE and TBD are complete without additional fields
    },
    
    getSummary: (data) => {
      const items: SummaryItem[] = [];
      
      const kindLabels = {
        PLACE: "Существующее место",
        MANUAL: "Ручной ввод",
        MOBILE: "Выездное событие",
        TBD: "Локация будет объявлена",
      };
      
      items.push({
        label: "Тип",
        value: data.venueKind 
          ? kindLabels[data.venueKind] 
          : <span className="text-red-500">Не выбран</span>,
        isMissing: !data.venueKind,
      });
      
      if (data.venueKind === "PLACE") {
        items.push({
          label: "Место",
          value: data.venueName || data.placeId || <span className="text-red-500">Не выбрано</span>,
          isMissing: !data.placeId,
        });
      } else if (data.venueKind === "MANUAL") {
        items.push(
          {
            label: "Площадка",
            value: data.venueName || <span className="text-red-500">Не указана</span>,
            isMissing: !data.venueName,
          },
          {
            label: "Адрес",
            value: data.address || <span className="text-red-500">Не указан</span>,
            isMissing: !data.address,
          },
          {
            label: "Город",
            value: data.city || <span className="text-red-500">Не указан</span>,
            isMissing: !data.city,
          }
        );
      } else if (data.venueKind === "MOBILE" || data.venueKind === "TBD") {
        if (data.venueNote) {
          items.push({
            label: "Примечание",
            value: data.venueNote,
          });
        }
      }
      
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.venueKind) {
        missing.push("Способ указания локации");
      } else if (data.venueKind === "PLACE") {
        if (!data.placeId) missing.push("Место проведения");
      } else if (data.venueKind === "MANUAL") {
        if (!data.venueName) missing.push("Название площадки");
        if (!data.address) missing.push("Адрес");
        if (!data.city) missing.push("Город");
      }
      return missing;
    },
  },
  
  // Step 3: Description
  {
    id: 3,
    key: "description",
    shortLabel: "Описание",
    title: "Описание",
    description: "Полное описание события",
    component: Step2Description,
    
    isComplete: (data) => {
      return Boolean(isRichTextMeaningful(data.fullDescription) && getRichTextLength(data.fullDescription) >= 20);
    },
    
    getSummary: (data) => {
      const textLength = getRichTextLength(data.fullDescription);
      const excerpt = createExcerpt(data.fullDescription, 100);
      
      return [
        {
          label: "Описание",
          value: isRichTextMeaningful(data.fullDescription)
            ? `${excerpt} (${textLength} символов)`
            : <span className="text-red-500">Не указано</span>,
          isMissing: !isRichTextMeaningful(data.fullDescription),
        },
      ];
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!isRichTextMeaningful(data.fullDescription) || getRichTextLength(data.fullDescription) < 20) {
        missing.push("Описание");
      }
      return missing;
    },
  },
  
  // Step 4: Media
  {
    id: 4,
    key: "media",
    shortLabel: "Фото",
    title: "Медиа",
    description: "Главное изображение, галерея и видео",
    component: Step3Media,
    
    isComplete: (data) => !!data.coverImage,
    
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
        value: `${data.gallery.length} изображений`,
      },
      {
        label: "Видео",
        value: data.reelsUrl ? "Добавлено" : "Не добавлено",
      },
    ],
    
    getMissingFields: (data) => {
      return data.coverImage ? [] : ["Главное изображение"];
    },
  },
  
  // Step 5: Schedule
  {
    id: 5,
    key: "schedule",
    shortLabel: "Расписание",
    title: "Дата и время",
    description: "Даты проведения и расписание",
    component: Step4DateTime,
    
    isComplete: (data) => {
      return data.dates.length > 0 && (data.allDay || Boolean(data.startTime && data.endTime));
    },
    
    getSummary: (data) => {
      const items: SummaryItem[] = [
        {
          label: "Режим",
          value: data.scheduleMode === "single" ? "Одна дата" : "Несколько дат",
        },
        {
          label: "Дат",
          value: data.dates.length > 0 
            ? data.dates.length 
            : <span className="text-red-500">Не добавлено</span>,
          isMissing: data.dates.length === 0,
        },
        {
          label: "Время",
          value: data.allDay ? "Весь день" : `${data.startTime} - ${data.endTime}`,
        },
      ];
      
      if (data.repeatEnabled) {
        items.push({
          label: "Повторение",
          value: data.repeatUnit || "Не настроено",
        });
      }
      
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (data.dates.length === 0) missing.push("Даты проведения");
      if (!data.allDay && !data.startTime) missing.push("Время начала");
      return missing;
    },
  },
  
  // Step 6: Pricing & Participation
  {
    id: 6,
    key: "pricing",
    shortLabel: "Цена",
    title: "Стоимость и запись",
    description: "Стоимость и как попасть на событие",
    component: Step5PricingParticipation,
    
    isComplete: (data) => {
      // Pricing mode must be selected
      if (!data.pricingMode) return false;
      
      // If paid, price must be filled
      if ((data.pricingMode === "fixed" || data.pricingMode === "from") && !data.price?.trim()) {
        return false;
      }
      
      // Participation mode must be selected
      if (!data.participationMode) return false;
      
      // If external link, ticketLink must be filled
      if (data.participationMode === "external-link" && !data.ticketLink?.trim()) {
        return false;
      }
      
      // If time slots, at least one date with slots must exist
      if (data.participationMode === "time-slots") {
        const hasSlots = data.timeSlots?.dates?.some(d => d.slots.length > 0);
        if (!hasSlots) return false;
      }

      if (data.participationMode === "prebook") {
        if (!data.prebookMethod) return false;
        if (data.prebookMethod === "phone" && !data.prebookPhone?.trim()) return false;
        if (data.prebookMethod === "link" && !data.prebookUrl?.trim()) return false;
      }
      
      return true;
    },
    
    getSummary: (data) => {
      const items: SummaryItem[] = [];
      
      // Pricing
      const priceValue = data.price?.trim() ? Number(data.price) : null;
      const isValidPrice = priceValue !== null && !isNaN(priceValue);
      
      const pricingLabels = {
        free: "Бесплатно",
        fixed: isValidPrice ? formatPrice(priceValue) : "—",
        from: isValidPrice ? formatPriceFrom(priceValue) : "—",
      };
      items.push({
        label: "Стоимость",
        value: data.pricingMode 
          ? pricingLabels[data.pricingMode] 
          : <span className="text-red-500">Не указана</span>,
        isMissing: !data.pricingMode,
      });
      
      // Participation
      const participationLabels = {
        "external-link": "Покупка по ссылке",
        "time-slots": "Запись по времени",
        "walk-in": "Узнать подробнее",
        "prebook": "Предварительная запись",
      };
      const effectiveParticipation = data.participationMode;
      items.push({
        label: "Как попасть",
        value: effectiveParticipation
          ? participationLabels[effectiveParticipation]
          : <span className="text-red-500">Не выбран</span>,
        isMissing: !data.participationMode,
      });
      
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      
      if (!data.pricingMode) {
        missing.push("Режим стоимости");
      } else if ((data.pricingMode === "fixed" || data.pricingMode === "from") && !data.price?.trim()) {
        missing.push("Цена");
      }
      
      if (!data.participationMode) {
        missing.push("Формат участия");
      } else {
        if (data.participationMode === "external-link" && !data.ticketLink?.trim()) {
          missing.push("Ссылка на покупку билетов");
        }
        if (data.participationMode === "time-slots") {
          const hasSlots = data.timeSlots?.dates?.some(d => d.slots.length > 0);
          if (!hasSlots) {
            missing.push("Расписание со слотами");
          }
        }
        if (data.participationMode === "prebook") {
          if (!data.prebookMethod) {
            missing.push("Способ предварительной записи");
          } else if (data.prebookMethod === "phone" && !data.prebookPhone?.trim()) {
            missing.push("Телефон для записи");
          } else if (data.prebookMethod === "link" && !data.prebookUrl?.trim()) {
            missing.push("Ссылка на запись");
          }
        }
      }
      
      return missing;
    },
  },
  
  // Step 7: Contacts
  {
    id: 7,
    key: "contacts",
    shortLabel: "Контакты",
    title: "Контакты",
    description: "Телефон, сайт и социальные сети",
    component: Step7Contacts,
    
    isComplete: () => true, // Optional step
    
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
        label: "Соцсети",
        value: (() => {
          const n = data.socialLinks.filter((l) => l.url.trim().length > 0).length;
          return n === 0 ? "Не указано" : `${n} шт.`;
        })(),
      },
    ],
    
    getMissingFields: () => [], // Optional step
  },
  
  // Step 8: Organizer
  {
    id: 8,
    key: "organizer",
    shortLabel: "Организатор",
    title: "Организатор",
    description: "Кто организует событие",
    component: Step8Organizer,
    
    isComplete: (data) => data.organizerName.trim().length >= 2 && 
      (data.organizerMode !== "existing" || !!data.organizerId),
    
    getSummary: (data) => [
      {
        label: "Организатор",
        value: data.organizerName || <span className="text-red-500">Не указан</span>,
        isMissing: !data.organizerName,
      },
      {
        label: "Тип",
        value:
          data.organizerMode === "existing"
            ? "Найденный"
            : data.organizerMode === "import"
              ? "Из источника"
              : "Новый",
      },
      ...(data.organizerPhone ? [{
        label: "Телефон",
        value: data.organizerPhone,
      }] : []),
      ...(data.organizerUnp ? [{
        label: "УНП",
        value: data.organizerUnp,
      }] : []),
      ...(data.organizerWebsite ? [{
        label: "Сайт",
        value: "Указан",
      }] : []),
      ...(data.organizerInstagram ? [{
        label: "Instagram",
        value: "Указан",
      }] : []),
    ],
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.organizerName || data.organizerName.trim().length < 2) {
        missing.push("Название организатора");
      }
      if (data.organizerMode === "existing" && !data.organizerId) {
        missing.push("Выбор организатора");
      }
      return missing;
    },
  },
];

/**
 * Get step config by ID
 */
export function getStepConfig(stepId: number): WizardStepConfig<EventFormData> | undefined {
  return EVENT_WIZARD_STEPS.find(step => step.id === stepId);
}

/**
 * Get step config by key
 */
export function getStepConfigByKey(key: string): WizardStepConfig<EventFormData> | undefined {
  return EVENT_WIZARD_STEPS.find(step => step.key === key);
}

/**
 * Get total number of content steps (excluding review)
 */
export const TOTAL_CONTENT_STEPS = EVENT_WIZARD_STEPS.length;

/** Контентные шаги + шаг «Проверка и отправка» */
export const TOTAL_EVENT_WIZARD_STEPS = EVENT_WIZARD_STEPS.length + 1;

/**
 * Get step label
 */
export function getStepLabel(stepId: number): string {
  const step = getStepConfig(stepId);
  return step ? step.title : `Шаг ${stepId}`;
}

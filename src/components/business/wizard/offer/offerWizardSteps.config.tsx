// Offer Wizard Steps Configuration
// Inherits Event Wizard architecture 1-to-1

import { WizardStepConfig, SummaryItem, buildReviewSections } from "../shared/types";
import type { OfferFormData } from "./types";

// Re-export buildReviewSections for convenience
export { buildReviewSections };

// Import step components
import { Step1Type } from "./steps/Step1Type";
import { Step2Information } from "./steps/Step2Information";
import { Step3Media } from "./steps/Step3Media";
import { Step4Conditions } from "./steps/Step4Conditions";
import { Step5Pricing } from "./steps/Step5Pricing";
import { Step6Contacts } from "./steps/Step6Contacts";
import { Step7Publication } from "./steps/Step7Publication";

/**
 * Offer Wizard Steps Configuration
 * Single source of truth for all steps
 */
export const OFFER_WIZARD_STEPS: WizardStepConfig<OfferFormData>[] = [
  // Step 1: Offer Type
  {
    id: 1,
    key: "type",
    shortLabel: "Тип",
    title: "Тип предложения",
    description: "Что предлагается пользователям?",
    component: Step1Type,
    
    isComplete: (data) => {
      return Boolean(
        data.offerKind &&
        (data.offerKind !== "course" || data.durationType) &&
        (data.offerKind !== "service" || (data.serviceType && data.locationType))
      );
    },
    
    getSummary: (data) => {
      const kindLabels = {
        course: "Курс / занятия",
        birthday: "Детский праздник",
        service: "Услуга",
      };
      
      const items: SummaryItem[] = [
        {
          label: "Тип",
          value: data.offerKind 
            ? kindLabels[data.offerKind] 
            : <span className="text-red-500">Не выбран</span>,
          isMissing: !data.offerKind,
        },
      ];
      
      if (data.offerKind === "course") {
        const durationLabels: Record<string, string> = {
          single: "Разовое занятие",
          recurring: "Курс / регулярные занятия",
          camp: "Лагерь / смена",
        };
        
        items.push({
          label: "Формат",
          value: data.durationType 
            ? (durationLabels[data.durationType] ?? data.durationType)
            : <span className="text-red-500">Не выбран</span>,
          isMissing: !data.durationType,
        });
      }
      
      if (data.offerKind === "service") {
        const serviceTypeLabels = {
          торт: "Торт",
          декор: "Декор",
          фотограф: "Фотограф",
          аниматор: "Аниматор",
          шоу: "Шоу",
          аквагрим: "Аквагрим",
          ведущий: "Ведущий",
          мастер_класс_на_выезд: "Мастер-класс на выезд",
          другое: "Другое",
        };
        
        const locationTypeLabels = {
          client_location: "У клиента",
          place: "В локации",
          remote: "Онлайн / удаленно",
        };
        
        items.push(
          {
            label: "Тип услуги",
            value: data.serviceType 
              ? serviceTypeLabels[data.serviceType] 
              : <span className="text-red-500">Не выбран</span>,
            isMissing: !data.serviceType,
          },
          {
            label: "Место оказания",
            value: data.locationType 
              ? locationTypeLabels[data.locationType] 
              : <span className="text-red-500">Не выбрано</span>,
            isMissing: !data.locationType,
          }
        );
      }
      
      if (data.intent) {
        items.push({
          label: "Раздел каталога",
          value: data.intent,
        });
      }
      
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.offerKind) missing.push("Тип предложения");
      if (data.offerKind === "course" && !data.durationType) missing.push("Формат занятий");
      if (data.offerKind === "service") {
        if (!data.serviceType) missing.push("Тип услуги");
        if (!data.locationType) missing.push("Место оказания услуги");
      }
      return missing;
    },
  },
  
  // Step 2: Public Information
  {
    id: 2,
    key: "information",
    shortLabel: "Детали",
    title: "Публичная информация",
    description: "Как предложение появится в каталоге",
    component: Step2Information,
    
    isComplete: (data) => {
      return Boolean(
        data.title.trim().length >= 3 &&
        data.fullDescription.trim().length >= 10
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
        value: data.fullDescription
          ? `${data.fullDescription.replace(/<[^>]*>/g, "").slice(0, 80)}…`
          : <span className="text-red-500">Не указано</span>,
        isMissing: !data.fullDescription,
      },
      {
        label: "Возраст",
        value: data.ageGroups.length > 0 
          ? data.ageGroups.join(", ") 
          : "Не указан",
      },
    ],
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      if (!data.title || data.title.trim().length < 3) missing.push("Название");
      if (!data.fullDescription || data.fullDescription.trim().length < 10) missing.push("Описание");
      return missing;
    },
  },
  
  // Step 3: Media
  {
    id: 3,
    key: "media",
    shortLabel: "Фото",
    title: "Медиа",
    description: "Главное изображение и галерея",
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
    ],
    
    getMissingFields: (data) => {
      return data.coverImage ? [] : ["Главное изображение"];
    },
  },
  
  // Step 4: Format and Conditions
  {
    id: 4,
    key: "conditions",
    shortLabel: "Условия",
    title: "Формат и условия",
    description: "Детали предложения в зависимости от типа",
    component: Step4Conditions,
    
    isComplete: (data) => {
      if (!data.offerKind) return false;
      
      if (data.offerKind === "course") {
        if (!data.durationType) return false;
        if (data.durationType === "camp") {
          return data.campSessions.some((s) => s.dateFrom && s.dateTo);
        }
        return Boolean(data.classDuration.trim() && data.classFormat);
      }
      if (data.offerKind === "birthday") {
        return Boolean(data.partyProgram.trim() && data.partyDuration.trim());
      }
      if (data.offerKind === "service") {
        return Boolean(data.serviceDescription.trim());
      }
      return false;
    },
    
    getSummary: (data) => {
      const items: SummaryItem[] = [];
      
      if (data.offerKind === "course") {
        if (data.durationType === "camp") {
          const sessionCount = data.campSessions.filter((s) => s.dateFrom && s.dateTo).length;
          items.push(
            {
              label: "Смены",
              value: sessionCount > 0
                ? `${sessionCount} смен(а)`
                : <span className="text-red-500">Не добавлены</span>,
              isMissing: sessionCount === 0,
            },
            {
              label: "Стоимость",
              value: data.campPriceText || "Не указана",
            },
          );
        } else {
          items.push(
            {
              label: "Продолжительность",
              value: data.classDuration || <span className="text-red-500">Не указана</span>,
              isMissing: !data.classDuration,
            },
            {
              label: "Размер группы",
              value: data.classGroupSize || "Не указан",
            },
            {
              label: "Формат",
              value: data.classFormat === "trial" ? "Пробное" :
                     data.classFormat === "course" ? "Курс" :
                     data.classFormat === "subscription" ? "Абонемент" :
                     <span className="text-red-500">Не выбран</span>,
              isMissing: !data.classFormat,
            }
          );
        }
      }
      
      if (data.offerKind === "birthday") {
        items.push(
          {
            label: "Программа",
            value: data.partyProgram || <span className="text-red-500">Не описана</span>,
            isMissing: !data.partyProgram,
          },
          {
            label: "Продолжительность",
            value: data.partyDuration || <span className="text-red-500">Не указана</span>,
            isMissing: !data.partyDuration,
          },
          {
            label: "Количество детей",
            value: data.partyChildrenCount || "Не указано",
          },
          {
            label: "Что включено",
            value: data.partyIncluded || "Не указано",
          }
        );
      }
      
      if (data.offerKind === "service") {
        items.push(
          {
            label: "Описание услуги",
            value: data.serviceDescription || <span className="text-red-500">Не указано</span>,
            isMissing: !data.serviceDescription,
          },
          {
            label: "Продолжительность",
            value: data.serviceDuration || "Не указана",
          },
          {
            label: "Зона обслуживания",
            value: data.serviceDeliveryArea || "Не указана",
          }
        );
      }
      
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      
      if (!data.offerKind) {
        missing.push("Тип предложения");
      } else {
        switch (data.offerKind) {
          case "course":
            if (!data.durationType) {
              missing.push("Формат занятий");
            } else if (data.durationType === "camp") {
              if (!data.campSessions.some((s) => s.dateFrom && s.dateTo)) {
                missing.push("Смены с датами");
              }
            } else {
              if (!data.classDuration.trim()) missing.push("Продолжительность занятия");
              if (!data.classFormat) missing.push("Формат занятия");
            }
            break;
          case "birthday":
            if (!data.partyProgram.trim()) missing.push("Программа праздника");
            if (!data.partyDuration.trim()) missing.push("Продолжительность");
            break;
          case "service":
            if (!data.serviceDescription.trim()) missing.push("Описание услуги");
            break;
        }
      }
      
      return missing;
    },
  },
  
  // Step 5: Pricing
  {
    id: 5,
    key: "pricing",
    shortLabel: "Цена",
    title: "Ценообразование",
    description: "Стоимость предложения",
    component: Step5Pricing,
    
    isComplete: (data) => {
      if (!data.pricingMode) return false;
      
      if (data.pricingMode === "single") {
        return Boolean(data.singlePrice.trim());
      }
      
      if (data.pricingMode === "multiple") {
        return data.pricingOptions.length > 0 &&
          data.pricingOptions.every(opt => opt.title.trim() && opt.price.trim());
      }
      
      return false;
    },
    
    getSummary: (data) => {
      const items: SummaryItem[] = [
        {
          label: "Режим",
          value: data.pricingMode === "single" ? "Одна цена" : 
                 data.pricingMode === "multiple" ? "Несколько вариантов" :
                 <span className="text-red-500">Не выбран</span>,
          isMissing: !data.pricingMode,
        },
      ];
      
      if (data.pricingMode === "single") {
        items.push({
          label: "Цена",
          value: data.singlePrice 
            ? `${data.singlePrice} ${data.singleCurrency}`
            : <span className="text-red-500">Не указана</span>,
          isMissing: !data.singlePrice,
        });
        
        if (data.singlePriceLabel) {
          items.push({
            label: "Подпись к цене",
            value: data.singlePriceLabel,
          });
        }
      }
      
      if (data.pricingMode === "multiple") {
        items.push({
          label: "Вариантов цен",
          value: data.pricingOptions.length > 0 
            ? data.pricingOptions.length 
            : <span className="text-red-500">Не добавлено</span>,
          isMissing: data.pricingOptions.length === 0,
        });
      }
      
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      
      if (!data.pricingMode) {
        missing.push("Режим ценообразования");
      } else if (data.pricingMode === "single" && !data.singlePrice.trim()) {
        missing.push("Цена");
      } else if (data.pricingMode === "multiple" && data.pricingOptions.length === 0) {
        missing.push("Варианты цен");
      }
      
      return missing;
    },
  },
  
  // Step 6: Contacts
  {
    id: 6,
    key: "contacts",
    shortLabel: "Контакты",
    title: "Локация и контакты",
    description: "Адрес, телефоны, сайт и социальные сети",
    component: Step6Contacts,
    
    isComplete: () => true, // Optional step
    
    getSummary: (data) => [
      {
        label: "Адрес",
        value: data.locationAddress || "Не указан",
      },
      {
        label: "Телефоны",
        value: data.phones.length > 0
          ? data.phones.map((p) => p.number).filter(Boolean).join(", ")
          : "Не указаны",
      },
      {
        label: "Сайт",
        value: data.website || "Не указан",
      },
      {
        label: "Соцсети",
        value: `${data.socialLinks.length} шт.`,
      },
    ],
    
    getMissingFields: () => [], // Optional step
  },
  
  // Step 7: CTA and Publication
  {
    id: 7,
    key: "publication",
    shortLabel: "Публикация",
    title: "Публикация",
    description: "Действие и финальные настройки",
    component: Step7Publication,
    
    isComplete: (data) => {
      if (!data.ctaType) return false;
      
      // Validate based on CTA type
      if (data.ctaType === "записаться" || data.ctaType === "отправить_заявку") {
        return Boolean(data.ctaPhone && data.ctaPhone.trim());
      }
      
      if (data.ctaType === "перейти_на_сайт" || data.ctaType === "купить_билет") {
        return Boolean(data.ctaLink && data.ctaLink.trim());
      }
      
      // Validate booking settings if CTA is "забронировать"
      if (data.ctaType === "забронировать") {
        const booking = data.bookingSettings;
        
        if (!booking.mode) return false;
        
        if (booking.mode === "request") {
          return Boolean(
            booking.selectionType &&
            booking.availableDaysAhead &&
            booking.availableDaysAhead > 0 &&
            booking.capacityPerUnit &&
            booking.capacityPerUnit > 0
          );
        }
        
        if (booking.mode === "slot") {
          const hasValidSchedule = booking.weeklyAvailability.some(day => 
            day.enabled && day.startTime && day.endTime
          );
          return Boolean(
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
          return Boolean(booking.externalUrl && booking.externalUrl.trim());
        }
      }
      
      return true;
    },
    
    getSummary: (data) => {
      const ctaLabels = {
        записаться: "Записаться",
        забронировать: "Забронировать",
        купить_билет: "Купить билет",
        отправить_заявку: "Отправить заявку",
        перейти_на_сайт: "Перейти на сайт",
      };
      
      const items: SummaryItem[] = [
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
      
      // Add booking settings summary
      if (data.ctaType === "забронировать" && data.bookingSettings.mode) {
        const bookingModeLabels = {
          request: "Запрос на бронь",
          slot: "Выбор слотов",
          external: "Внешнее бронирование",
        };
        
        items.push({
          label: "Способ бронирования",
          value: bookingModeLabels[data.bookingSettings.mode],
        });
        
        if (data.bookingSettings.mode === "request" && data.bookingSettings.selectionType) {
          const selectionLabels = {
            date_only: "Только дата",
            date_time: "Дата и время",
          };
          items.push({
            label: "Клиент выбирает",
            value: selectionLabels[data.bookingSettings.selectionType],
          });
        }
        
        if (data.bookingSettings.availableDaysAhead) {
          items.push({
            label: "Дней вперёд",
            value: `${data.bookingSettings.availableDaysAhead} дн.`,
          });
        }
        
        if (data.bookingSettings.mode === "slot" && data.bookingSettings.slotDurationMinutes) {
          items.push({
            label: "Длительность слота",
            value: `${data.bookingSettings.slotDurationMinutes} мин.`,
          });
        }
        
        if (data.bookingSettings.mode === "external" && data.bookingSettings.externalUrl) {
          items.push({
            label: "Внешняя ссылка",
            value: "Указана",
          });
        }
      }
      
      if (data.ctaInstructions) {
        items.push({
          label: "Инструкции",
          value: `${data.ctaInstructions.length} символов`,
        });
      }
      
      return items;
    },
    
    getMissingFields: (data) => {
      const missing: string[] = [];
      
      if (!data.ctaType) {
        missing.push("Тип действия");
      } else {
        if ((data.ctaType === "записаться" || data.ctaType === "отправить_заявку") && !data.ctaPhone) {
          missing.push("Телефон для связи");
        }
        if ((data.ctaType === "перейти_на_сайт" || data.ctaType === "купить_билет") && !data.ctaLink) {
          missing.push("Ссылка");
        }
        
        // Check booking settings
        if (data.ctaType === "забронировать") {
          const booking = data.bookingSettings;
          
          if (!booking.mode) {
            missing.push("Способ бронирования");
          } else {
            if (booking.mode === "request") {
              if (!booking.selectionType) missing.push("Что выбирает клиент");
              if (!booking.availableDaysAhead) missing.push("Дни вперёд для бронирования");
              if (!booking.capacityPerUnit) missing.push("Количество заявок");
            }
            
            if (booking.mode === "slot") {
              if (!booking.availableDaysAhead) missing.push("Дни вперёд для записи");
              if (!booking.slotDurationMinutes) missing.push("Длительность слота");
              if (!booking.capacityPerUnit) missing.push("Количество клиентов в слот");
              
              const hasValidSchedule = booking.weeklyAvailability.some(day => 
                day.enabled && day.startTime && day.endTime
              );
              if (!hasValidSchedule) missing.push("Расписание работы");
            }
            
            if (booking.mode === "external") {
              if (!booking.externalUrl) missing.push("Ссылка для бронирования");
            }
          }
        }
      }
      
      return missing;
    },
  },
];

/**
 * Get step config by ID
 */
export function getStepConfig(stepId: number): WizardStepConfig<OfferFormData> | undefined {
  return OFFER_WIZARD_STEPS.find(step => step.id === stepId);
}

/**
 * Get step config by key
 */
export function getStepConfigByKey(key: string): WizardStepConfig<OfferFormData> | undefined {
  return OFFER_WIZARD_STEPS.find(step => step.key === key);
}

/**
 * Get total number of content steps (excluding review)
 */
export const TOTAL_CONTENT_STEPS = OFFER_WIZARD_STEPS.length;

/**
 * Get step label
 */
export function getStepLabel(stepId: number): string {
  const step = getStepConfig(stepId);
  return step ? step.title : `Шаг ${stepId}`;
}
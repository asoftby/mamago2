import type { ActivityFormData } from "./types";

/**
 * Demo presets for quick testing
 */

export const singleEventPreset: ActivityFormData = {
  title: "Мастер-класс по керамике",
  description: "Создайте свою уникальную керамическую посуду",
  duration: "90 минут",
  ageContext: "Для взрослых",
  activityType: "event",
  bookingMode: "single",
  pricingMode: "fixed",
  ctaType: "book",
  price: 35,
  priceFrom: 0,
  schedule: { dates: [] },
  singleDate: "2026-03-18",
  singleTime: "12:00–13:30",
};

export const courseWithSlotsPreset: ActivityFormData = {
  title: "Курс рисования для детей",
  description: "Развиваем творческие способности через искусство",
  duration: "60 минут",
  ageContext: "Для детей 5–7 лет",
  activityType: "course",
  bookingMode: "slots",
  pricingMode: "fixed",
  ctaType: "book",
  price: 20,
  priceFrom: 0,
  schedule: {
    dates: [
      {
        id: "date-1",
        isoDate: "2026-03-18",
        label: "18 марта, ср",
        slots: [
          {
            id: "slot-1",
            startTime: "10:00",
            endTime: "11:00",
            capacity: 6,
          },
          {
            id: "slot-2",
            startTime: "13:00",
            endTime: "14:00",
            capacity: 6,
          },
        ],
      },
      {
        id: "date-2",
        isoDate: "2026-03-19",
        label: "19 марта, чт",
        slots: [
          {
            id: "slot-3",
            startTime: "11:00",
            endTime: "12:00",
            capacity: 8,
          },
        ],
      },
    ],
  },
  singleDate: null,
  singleTime: null,
};

export const serviceByRequestPreset: ActivityFormData = {
  title: "Консультация психолога",
  description: "Индивидуальная консультация для родителей",
  duration: "45 минут",
  ageContext: "Для родителей",
  activityType: "service",
  bookingMode: "request",
  pricingMode: "from",
  ctaType: "request",
  price: 0,
  priceFrom: 50,
  schedule: { dates: [] },
  singleDate: null,
  singleTime: null,
};

export const presets = {
  singleEvent: singleEventPreset,
  courseWithSlots: courseWithSlotsPreset,
  serviceByRequest: serviceByRequestPreset,
};

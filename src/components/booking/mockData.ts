import type { BookingProduct } from "./types";

/**
 * Mock data for booking/sales module demos
 */

export const singleEventDemo: BookingProduct = {
  id: "single-1",
  mode: "single",
  title: "Мастер-класс по керамике",
  subtitle: "Разовое событие",
  meta: "90 минут",
  priceLabel: "35 BYN",
  priceSubtext: "за участие",
  ctaLabel: "Записаться",
  singleDateLabel: "16 марта 2026",
  singleTimeLabel: "12:00–13:30",
  availabilityStatus: "low",
  availabilityText: "Осталось 4 места",
};

export const multiDateEventDemo: BookingProduct = {
  id: "multi-1",
  mode: "multi-date",
  title: 'Детский спектакль "Лиса и медведь"',
  subtitle: "Театральная постановка",
  meta: "Для детей 4–8 лет • 45 минут",
  priceLabel: "25 BYN",
  priceSubtext: "за билет",
  ctaLabel: "Купить билет",
  dates: [
    {
      id: "date-1",
      label: "16 мар",
      isoDate: "2026-03-16",
      status: "available",
      remaining: 15,
    },
    {
      id: "date-2",
      label: "17 мар",
      isoDate: "2026-03-17",
      status: "low",
      remaining: 3,
    },
    {
      id: "date-3",
      label: "18 мар",
      isoDate: "2026-03-18",
      status: "sold-out",
      remaining: 0,
    },
    {
      id: "date-4",
      label: "19 мар",
      isoDate: "2026-03-19",
      status: "available",
      remaining: 12,
    },
  ],
};

export const slotsServiceDemo: BookingProduct = {
  id: "slots-1",
  mode: "slots",
  title: "Пробное занятие по рисованию",
  subtitle: "Первое занятие в группе",
  meta: "Для детей 5–7 лет • 60 минут",
  priceLabel: "20 BYN",
  priceSubtext: "за занятие",
  ctaLabel: "Записаться",
  dates: [
    {
      id: "date-1",
      label: "18 мар",
      isoDate: "2026-03-18",
      status: "available",
      remaining: 8,
      slots: [
        {
          id: "slot-1",
          label: "11:00",
          startTime: "11:00",
          endTime: "12:00",
          status: "available",
          remaining: 5,
        },
        {
          id: "slot-2",
          label: "13:00",
          startTime: "13:00",
          endTime: "14:00",
          status: "low",
          remaining: 2,
        },
        {
          id: "slot-3",
          label: "17:00",
          startTime: "17:00",
          endTime: "18:00",
          status: "available",
          remaining: 6,
        },
      ],
    },
    {
      id: "date-2",
      label: "19 мар",
      isoDate: "2026-03-19",
      status: "low",
      remaining: 2,
      slots: [
        {
          id: "slot-4",
          label: "11:00",
          startTime: "11:00",
          endTime: "12:00",
          status: "sold-out",
          remaining: 0,
          disabled: true,
        },
        {
          id: "slot-5",
          label: "13:00",
          startTime: "13:00",
          endTime: "14:00",
          status: "low",
          remaining: 2,
        },
        {
          id: "slot-6",
          label: "17:00",
          startTime: "17:00",
          endTime: "18:00",
          status: "sold-out",
          remaining: 0,
          disabled: true,
        },
      ],
    },
    {
      id: "date-3",
      label: "20 мар",
      isoDate: "2026-03-20",
      status: "available",
      remaining: 10,
      slots: [
        {
          id: "slot-7",
          label: "11:00",
          startTime: "11:00",
          endTime: "12:00",
          status: "available",
          remaining: 4,
        },
        {
          id: "slot-8",
          label: "13:00",
          startTime: "13:00",
          endTime: "14:00",
          status: "available",
          remaining: 3,
        },
        {
          id: "slot-9",
          label: "17:00",
          startTime: "17:00",
          endTime: "18:00",
          status: "available",
          remaining: 3,
        },
      ],
    },
  ],
};

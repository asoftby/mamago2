/**
 * Activity Form Builder Types
 * 
 * Unified activity architecture for events, courses, services, and offers
 */

import type { ScheduleEditorValue } from "@/components/schedule-editor/types";

export type ActivityType = 
  | "event"      // Событие
  | "course"     // Курс
  | "lesson"     // Занятие
  | "service"    // Услуга
  | "offer";     // Предложение

export type BookingMode =
  | "none"        // Без записи
  | "request"     // Заявка
  | "single"      // Одна дата
  | "multi-date"  // Несколько дат
  | "slots";      // Слоты

export type PricingMode =
  | "free"        // Бесплатно
  | "fixed"       // Фиксированная цена
  | "from"        // Цена "от"
  | "on-request"; // По запросу

export type ActivityCTAType =
  | "book"        // Записаться
  | "buy"         // Купить
  | "request"     // Оставить заявку
  | "details";    // Подробнее

export interface ActivityFormData {
  // Basic Info
  title: string;
  description: string;
  duration: string;
  ageContext: string;
  
  // Type & Mode
  activityType: ActivityType;
  bookingMode: BookingMode;
  pricingMode: PricingMode;
  ctaType: ActivityCTAType;
  
  // Pricing
  price: number;
  priceFrom: number;
  
  // Schedule
  schedule: ScheduleEditorValue;
  singleDate: string | null;
  singleTime: string | null;
}

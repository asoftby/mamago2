/**
 * OpeningHours UI Types
 * Client-side types for UI components
 */

import type { OpeningHoursMode, DayOfWeek } from "@prisma/client";
import { OPENING_HOURS_DAYS } from "@/domain/opening-hours/structuredOpeningHours";

/**
 * Time interval for UI
 */
export interface TimeInterval {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

/**
 * Day rule for UI
 */
export interface DayRule {
  dayOfWeek: DayOfWeek;
  isOpen: boolean;
  allDay: boolean;
  intervals: TimeInterval[];
}

/**
 * Opening hours data for UI (controlled component state)
 */
export interface OpeningHoursData {
  mode: OpeningHoursMode;
  timezone: string;
  note?: string;
  rules: DayRule[];
}

/**
 * Day of week labels in Russian
 */
export const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: "Понедельник",
  TUE: "Вторник",
  WED: "Среда",
  THU: "Четверг",
  FRI: "Пятница",
  SAT: "Суббота",
  SUN: "Воскресенье",
};

/**
 * Day of week short labels in Russian
 */
export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  MON: "Пн",
  TUE: "Вт",
  WED: "Ср",
  THU: "Чт",
  FRI: "Пт",
  SAT: "Сб",
  SUN: "Вс",
};

/**
 * Mode labels in Russian
 */
export const MODE_LABELS: Record<OpeningHoursMode, string> = {
  WEEKLY: "Недельный график",
  ALWAYS_OPEN: "Круглосуточно",
  BY_APPOINTMENT: "По записи",
  TEMPORARILY_CLOSED: "Временно закрыто",
};

/**
 * All days of week in order
 */
export const ALL_DAYS: DayOfWeek[] = [...OPENING_HOURS_DAYS];

/**
 * Weekdays
 */
export const WEEKDAYS: DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI"];

/**
 * Weekend days
 */
export const WEEKEND_DAYS: DayOfWeek[] = ["SAT", "SUN"];

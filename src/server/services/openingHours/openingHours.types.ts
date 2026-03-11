/**
 * Opening Hours Types
 * Type definitions for opening hours business logic
 */

import type { Prisma } from "@prisma/client";

/**
 * OpeningHours with all relations loaded
 */
export type OpeningHoursWithRelations = Prisma.OpeningHoursGetPayload<{
  include: {
    rules: {
      include: {
        intervals: true;
      };
    };
    exceptions: {
      include: {
        intervals: true;
      };
    };
  };
}>;

/**
 * Time interval (HH:MM format)
 */
export interface TimeInterval {
  startTime: string; // "09:00"
  endTime: string; // "18:00"
}

/**
 * Opening status result
 */
export interface OpeningStatus {
  isOpen: boolean;
  status: "open" | "closed" | "always_open" | "by_appointment" | "temporarily_closed";
  message: string; // Human-readable message in Russian
  nextChange?: Date; // When status will change (if applicable)
  todayIntervals?: TimeInterval[]; // Today's intervals (if applicable)
}

/**
 * Parsed time components
 */
export interface ParsedTime {
  hours: number; // 0-23
  minutes: number; // 0-59
}

/**
 * Day of week mapping to JS Date.getDay()
 */
export const DAY_OF_WEEK_MAP = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
} as const;

/**
 * Reverse mapping from JS Date.getDay() to DayOfWeek enum
 */
export const JS_DAY_TO_DAY_OF_WEEK = {
  0: "SUN",
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
} as const;

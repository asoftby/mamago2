/**
 * Opening Hours Utilities
 * Pure utility functions for time parsing and comparison
 */

import { toZonedTime, format } from "date-fns-tz";
import type { ParsedTime } from "./openingHours.types";

/**
 * Parse time string in HH:MM format
 * @param timeStr - Time string (e.g., "09:00", "9:00", "23:59")
 * @returns Parsed time components or null if invalid
 */
export function parseTime(timeStr: string): ParsedTime | null {
  if (!timeStr) return null;

  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

/**
 * Format time components to HH:MM string
 * @param hours - Hours (0-23)
 * @param minutes - Minutes (0-59)
 * @returns Formatted time string
 */
export function formatTime(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * Compare two time strings
 * @param time1 - First time (HH:MM)
 * @param time2 - Second time (HH:MM)
 * @returns -1 if time1 < time2, 0 if equal, 1 if time1 > time2, null if invalid
 */
export function compareTime(time1: string, time2: string): number | null {
  const t1 = parseTime(time1);
  const t2 = parseTime(time2);

  if (!t1 || !t2) return null;

  if (t1.hours !== t2.hours) {
    return t1.hours < t2.hours ? -1 : 1;
  }

  if (t1.minutes !== t2.minutes) {
    return t1.minutes < t2.minutes ? -1 : 1;
  }

  return 0;
}

/**
 * Check if a time falls within an interval
 * @param time - Time to check (HH:MM)
 * @param startTime - Interval start (HH:MM)
 * @param endTime - Interval end (HH:MM)
 * @returns True if time is within interval (inclusive start, exclusive end)
 */
export function isTimeInInterval(
  time: string,
  startTime: string,
  endTime: string
): boolean {
  const cmpStart = compareTime(time, startTime);
  const cmpEnd = compareTime(time, endTime);

  if (cmpStart === null || cmpEnd === null) return false;

  // time >= startTime && time < endTime
  return cmpStart >= 0 && cmpEnd < 0;
}

/**
 * Get current time in specified timezone
 * @param timezone - IANA timezone string (e.g., "Europe/Minsk")
 * @returns Date object in the specified timezone
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Format date to YYYY-MM-DD string in timezone
 * @param date - Date object
 * @param timezone - IANA timezone string
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateInTimezone(date: Date, timezone: string): string {
  return format(toZonedTime(date, timezone), "yyyy-MM-dd", { timeZone: timezone });
}

/**
 * Get current time as HH:MM string in timezone
 * @param date - Date object
 * @param timezone - IANA timezone string
 * @returns Time string in HH:MM format
 */
export function getTimeStringInTimezone(date: Date, timezone: string): string {
  return format(toZonedTime(date, timezone), "HH:mm", { timeZone: timezone });
}

/**
 * Get day of week (0-6, Sunday=0) in timezone
 * @param date - Date object
 * @param timezone - IANA timezone string
 * @returns Day of week (0-6)
 */
export function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const zonedDate = toZonedTime(date, timezone);
  return zonedDate.getDay();
}

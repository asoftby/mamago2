/**
 * OpeningHours Validator
 * Server-side validation for opening hours payloads
 */

import type { OpeningHoursData, TimeInterval } from "@/components/openingHours";

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate time format (HH:MM)
 */
function isValidTimeFormat(time: string): boolean {
  const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return regex.test(time);
}

/**
 * Parse time to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if two intervals overlap
 */
function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);

  // Check if intervals overlap
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Validate opening hours data
 */
export function validateOpeningHours(data: OpeningHoursData): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate mode
  if (!data.mode) {
    errors.push({ field: "mode", message: "Режим работы обязателен" });
    return { valid: false, errors };
  }

  // Validate timezone
  if (!data.timezone) {
    errors.push({ field: "timezone", message: "Часовой пояс обязателен" });
  }

  // For non-WEEKLY modes, no further validation needed
  if (data.mode !== "WEEKLY") {
    return { valid: errors.length === 0, errors };
  }

  // Validate WEEKLY mode rules
  if (!data.rules || data.rules.length === 0) {
    errors.push({ field: "rules", message: "Недельный график не может быть пустым" });
    return { valid: false, errors };
  }

  // Validate each day
  for (const rule of data.rules) {
    const dayLabel = rule.dayOfWeek;

    // Skip closed days
    if (!rule.isOpen) continue;

    // If allDay, no intervals needed
    if (rule.allDay) continue;

    // Open day must have at least 1 interval
    if (!rule.intervals || rule.intervals.length === 0) {
      errors.push({
        field: `rules.${dayLabel}.intervals`,
        message: `${dayLabel}: открытый день должен иметь хотя бы один интервал`,
      });
      continue;
    }

    // Max 2 intervals per day
    if (rule.intervals.length > 2) {
      errors.push({
        field: `rules.${dayLabel}.intervals`,
        message: `${dayLabel}: максимум 2 интервала на день`,
      });
    }

    // Validate each interval
    for (let i = 0; i < rule.intervals.length; i++) {
      const interval = rule.intervals[i];
      const prefix = `rules.${dayLabel}.intervals[${i}]`;

      // Validate time format
      if (!isValidTimeFormat(interval.startTime)) {
        errors.push({
          field: `${prefix}.startTime`,
          message: `${dayLabel}: неверный формат времени начала (должен быть HH:MM)`,
        });
      }

      if (!isValidTimeFormat(interval.endTime)) {
        errors.push({
          field: `${prefix}.endTime`,
          message: `${dayLabel}: неверный формат времени окончания (должен быть HH:MM)`,
        });
      }

      // Validate startTime < endTime
      if (
        isValidTimeFormat(interval.startTime) &&
        isValidTimeFormat(interval.endTime)
      ) {
        const startMinutes = timeToMinutes(interval.startTime);
        const endMinutes = timeToMinutes(interval.endTime);

        if (startMinutes >= endMinutes) {
          errors.push({
            field: `${prefix}`,
            message: `${dayLabel}: время начала должно быть раньше времени окончания`,
          });
        }
      }

      // Check for overlaps with other intervals
      for (let j = i + 1; j < rule.intervals.length; j++) {
        const otherInterval = rule.intervals[j];

        if (
          isValidTimeFormat(interval.startTime) &&
          isValidTimeFormat(interval.endTime) &&
          isValidTimeFormat(otherInterval.startTime) &&
          isValidTimeFormat(otherInterval.endTime)
        ) {
          if (intervalsOverlap(interval, otherInterval)) {
            errors.push({
              field: `rules.${dayLabel}.intervals`,
              message: `${dayLabel}: интервалы не должны пересекаться`,
            });
            break; // Only report once per day
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate and throw if invalid
 * Useful for API routes
 */
export function validateOpeningHoursOrThrow(data: OpeningHoursData): void {
  const result = validateOpeningHours(data);

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => `${e.field}: ${e.message}`).join("; ");
    throw new Error(`Validation failed: ${errorMessages}`);
  }
}

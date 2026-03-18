/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OpeningHours Mapper
 * Maps between UI state, domain models, and Prisma payloads
 */

import type { OpeningHoursData, DayRule } from "@/components/openingHours";
import type { OpeningHoursWithRelations } from "@/server/services/openingHours/openingHours.types";
import type { Prisma } from "@prisma/client";
import { ALL_DAYS } from "@/components/openingHours";

/**
 * Map database/domain model to UI state
 * Used when loading existing opening hours into the editor
 */
export function mapToUIState(
  dbData: OpeningHoursWithRelations | null
): OpeningHoursData | null {
  if (!dbData) return createDefaultUIState();

  // Create a map of existing rules for quick lookup
  const existingRules = new Map(
    dbData.rules.map((rule: any) => [rule.dayOfWeek, rule])
  );

  // Always create rules for all 7 days, using existing data where available
  const allDayRules: DayRule[] = ALL_DAYS.map((dayOfWeek) => {
    const existingRule: any = existingRules.get(dayOfWeek);
    
    if (existingRule) {
      // Use existing rule data
      return {
        dayOfWeek,
        isOpen: existingRule.isOpen,
        allDay: existingRule.allDay,
        intervals: existingRule.intervals
          .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
          .map((interval: any) => ({
            startTime: interval.startTime,
            endTime: interval.endTime,
          })),
      };
    } else {
      // Create default closed day for missing rules
      return {
        dayOfWeek,
        isOpen: false,
        allDay: false,
        intervals: [],
      };
    }
  });

  return {
    mode: dbData.mode,
    timezone: dbData.timezone || "Europe/Minsk",
    note: dbData.note || undefined,
    rules: allDayRules,
  };
}

/**
 * Map UI state to Prisma create payload
 * Used when creating new opening hours
 */
export function mapToCreatePayload(
  uiData: OpeningHoursData
): Prisma.OpeningHoursCreateInput {
  // For non-WEEKLY modes, don't create rules
  if (uiData.mode !== "WEEKLY") {
    return {
      mode: uiData.mode,
      timezone: uiData.timezone,
      note: uiData.note || null,
    };
  }

  // For WEEKLY mode, create rules with intervals
  return {
    mode: uiData.mode,
    timezone: uiData.timezone,
    note: uiData.note || null,
    rules: {
      create: uiData.rules
        .filter((rule) => rule.isOpen) // Only create rules for open days
        .map((rule) => ({
          dayOfWeek: rule.dayOfWeek,
          isOpen: true,
          allDay: rule.allDay,
          intervals: rule.allDay
            ? undefined // Don't create intervals if allDay
            : {
                create: rule.intervals.map((interval, idx) => ({
                  startTime: interval.startTime,
                  endTime: interval.endTime,
                  sortOrder: idx,
                })),
              },
        })),
    },
  };
}

/**
 * Map UI state to Prisma update payload
 * Used when updating existing opening hours
 * 
 * Strategy: Delete all existing rules and recreate from UI state
 * This is simpler than trying to diff and update individual rules
 */
export function mapToUpdatePayload(
  uiData: OpeningHoursData
): Prisma.OpeningHoursUpdateInput {
  // For non-WEEKLY modes, delete all rules
  if (uiData.mode !== "WEEKLY") {
    return {
      mode: uiData.mode,
      timezone: uiData.timezone,
      note: uiData.note || null,
      rules: {
        deleteMany: {}, // Delete all existing rules
      },
    };
  }

  // For WEEKLY mode, delete all and recreate
  return {
    mode: uiData.mode,
    timezone: uiData.timezone,
    note: uiData.note || null,
    rules: {
      deleteMany: {}, // Delete all existing rules
      create: uiData.rules
        .filter((rule) => rule.isOpen) // Only create rules for open days
        .map((rule) => ({
          dayOfWeek: rule.dayOfWeek,
          isOpen: true,
          allDay: rule.allDay,
          intervals: rule.allDay
            ? undefined
            : {
                create: rule.intervals.map((interval, idx) => ({
                  startTime: interval.startTime,
                  endTime: interval.endTime,
                  sortOrder: idx,
                })),
              },
        })),
    },
  };
}

/**
 * Create default UI state for new places
 * All days closed by default
 */
export function createDefaultUIState(timezone = "Europe/Minsk"): OpeningHoursData {
  return {
    mode: "WEEKLY",
    timezone,
    rules: ALL_DAYS.map((day) => ({
      dayOfWeek: day,
      isOpen: false,
      allDay: false,
      intervals: [],
    })),
  };
}

/**
 * Generate human-readable summary for review step
 */
export function generateSummary(uiData: OpeningHoursData | null): string {
  if (!uiData) return "Режим работы не указан";

  switch (uiData.mode) {
    case "ALWAYS_OPEN":
      return "Круглосуточно";
    case "BY_APPOINTMENT":
      return "По записи";
    case "TEMPORARILY_CLOSED":
      return uiData.note || "Временно закрыто";
    case "WEEKLY": {
      const openDays = uiData.rules.filter((r) => r.isOpen);
      if (openDays.length === 0) return "Все дни закрыты";

      // Group consecutive days with same schedule
      const lines: string[] = [];
      let currentGroup: DayRule[] = [];

      for (const day of openDays) {
        if (currentGroup.length === 0) {
          currentGroup.push(day);
        } else {
          const prev = currentGroup[currentGroup.length - 1];
          // Check if schedule matches
          const scheduleMatches =
            prev.allDay === day.allDay &&
            JSON.stringify(prev.intervals) === JSON.stringify(day.intervals);

          if (scheduleMatches) {
            currentGroup.push(day);
          } else {
            // Flush current group
            lines.push(formatDayGroup(currentGroup));
            currentGroup = [day];
          }
        }
      }

      // Flush last group
      if (currentGroup.length > 0) {
        lines.push(formatDayGroup(currentGroup));
      }

      return lines.join("\n");
    }
  }
}

/**
 * Format a group of days with same schedule
 */
function formatDayGroup(days: DayRule[]): string {
  const dayLabels: Record<string, string> = {
    MON: "Пн",
    TUE: "Вт",
    WED: "Ср",
    THU: "Чт",
    FRI: "Пт",
    SAT: "Сб",
    SUN: "Вс",
  };

  const dayNames =
    days.length === 1
      ? dayLabels[days[0].dayOfWeek]
      : `${dayLabels[days[0].dayOfWeek]}–${dayLabels[days[days.length - 1].dayOfWeek]}`;

  const schedule = days[0].allDay
    ? "круглосуточно"
    : days[0].intervals.map((i) => `${i.startTime}–${i.endTime}`).join(", ");

  return `${dayNames}: ${schedule}`;
}

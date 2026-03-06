/**
 * Activity Classification Helper
 * Determines which section(s) an activity belongs to based on type and scheduleMode
 */

import { ActivityType, ScheduleMode } from "@prisma/client";

export type ActivitySection = "where-to-go" | "classes" | "always-nearby";

/**
 * Get sections where activity will be published
 * 
 * Rules:
 * - COURSE or RECURRING → "Занятия" (classes)
 * - PERMANENT with ON_DEMAND or ALWAYS → "Куда пойти" + "Всегда рядом"
 * - Everything else → "Куда пойти" (where-to-go)
 */
export function getActivitySections(
  type: ActivityType,
  scheduleMode: ScheduleMode
): ActivitySection[] {
  const sections: ActivitySection[] = [];

  // COURSE or RECURRING schedule → Classes
  if (type === "COURSE" || scheduleMode === "RECURRING") {
    sections.push("classes");
    return sections;
  }

  // PERMANENT with ON_DEMAND or ALWAYS → Where to go + Always nearby
  if (type === "PERMANENT" && (scheduleMode === "ON_DEMAND" || scheduleMode === "ALWAYS")) {
    sections.push("where-to-go");
    sections.push("always-nearby");
    return sections;
  }

  // Everything else → Where to go
  sections.push("where-to-go");
  return sections;
}

/**
 * Get primary section for display
 */
export function getPrimarySection(
  type: ActivityType,
  scheduleMode: ScheduleMode
): ActivitySection {
  const sections = getActivitySections(type, scheduleMode);
  return sections[0];
}

/**
 * Get human-readable section names (Russian)
 */
export function getSectionLabel(section: ActivitySection): string {
  const labels: Record<ActivitySection, string> = {
    "where-to-go": "Куда пойти",
    "classes": "Занятия",
    "always-nearby": "Всегда рядом",
  };
  return labels[section];
}

/**
 * Get all section labels for an activity
 */
export function getActivitySectionLabels(
  type: ActivityType,
  scheduleMode: ScheduleMode
): string[] {
  const sections = getActivitySections(type, scheduleMode);
  return sections.map(getSectionLabel);
}

/**
 * Validate placeId requirement based on activity type
 * ROUTE doesn't require placeId, all others do
 */
export function isPlaceRequired(type: ActivityType): boolean {
  return type !== "ROUTE";
}

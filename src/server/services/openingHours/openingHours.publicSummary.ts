import { ALL_DAYS, DAY_SHORT_LABELS } from "@/components/openingHours/openingHours.types";
import { getOpeningStatus } from "./openingHours.service";
import type { OpeningHoursWithRelations } from "./openingHours.types";

/**
 * Текст для публичной карточки места: текущий статус + недельное расписание (если есть).
 */
export function buildPublicWorkingHoursText(
  openingHours: OpeningHoursWithRelations,
  now: Date = new Date(),
): string {
  const status = getOpeningStatus(openingHours, now);
  const { mode, note, rules } = openingHours;

  if (mode === "ALWAYS_OPEN") {
    return status.message;
  }

  if (mode === "BY_APPOINTMENT") {
    const parts = [status.message];
    if (note?.trim()) parts.push(note.trim());
    return parts.join("\n");
  }

  if (mode === "TEMPORARILY_CLOSED") {
    return note?.trim() || status.message;
  }

  if (mode !== "WEEKLY" || !rules?.length) {
    return status.message;
  }

  const lines: string[] = [status.message, ""];

  for (const day of ALL_DAYS) {
    const rule = rules.find((r) => r.dayOfWeek === day);
    const label = DAY_SHORT_LABELS[day];
    if (!rule || !rule.isOpen) {
      lines.push(`${label}: выходной`);
      continue;
    }
    if (rule.allDay) {
      lines.push(`${label}: круглосуточно`);
      continue;
    }
    const intervals = [...(rule.intervals ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const timeStr =
      intervals.length > 0
        ? intervals
            .map((i) => `${i.startTime.slice(0, 5)}–${i.endTime.slice(0, 5)}`)
            .join(", ")
        : "уточняйте";
    lines.push(`${label}: ${timeStr}`);
  }

  if (note?.trim()) {
    lines.push("");
    lines.push(note.trim());
  }

  return lines.join("\n").trim();
}

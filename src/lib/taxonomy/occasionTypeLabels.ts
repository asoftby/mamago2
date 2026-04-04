import type { OccasionType } from "@prisma/client";

export const OCCASION_TYPE_LABELS: Record<OccasionType, string> = {
  HOLIDAY: "Праздник",
  SEASON: "Сезон",
  EVENT: "Событие",
  FAMILY: "Семейный",
};

export function occasionTypeLabel(type: OccasionType): string {
  return OCCASION_TYPE_LABELS[type] ?? type;
}

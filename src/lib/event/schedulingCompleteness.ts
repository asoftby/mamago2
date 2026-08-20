export type PersistedSchedulingKind = "SLOT" | "WINDOW" | null;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validTimeRange(start: unknown, end: unknown): boolean {
  const startTime = String(start ?? "");
  const endTime = String(end ?? "");
  return TIME_PATTERN.test(startTime) && TIME_PATTERN.test(endTime) && startTime !== endTime;
}

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validDuration(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 600;
}

/** Write-side contract only: never infers SLOT/WINDOW and never invents duration. */
export function isSlotScheduleDataComplete(scheduleJson: unknown): boolean {
  const schedule = record(scheduleJson);
  if (!schedule) return false;
  const durationIsValid = validDuration(schedule.durationMinutes);
  const items = Array.isArray(schedule.scheduleItems) ? schedule.scheduleItems : [];

  if (items.length === 0) {
    return TIME_PATTERN.test(String(schedule.startTime ?? "")) &&
      (validTimeRange(schedule.startTime, schedule.endTime) || durationIsValid);
  }

  return items.every((value) => {
    const item = record(value);
    if (!item || item.allDay === true || !TIME_PATTERN.test(String(item.startTime ?? ""))) return false;
    return validTimeRange(item.startTime, item.endTime) || durationIsValid;
  });
}

export function validateSchedulingCompleteness(
  kind: PersistedSchedulingKind,
  scheduleJson: unknown,
): string | null {
  if (kind !== "SLOT" || isSlotScheduleDataComplete(scheduleJson)) return null;
  return "Для события в конкретное время укажите время начала и окончания или продолжительность";
}

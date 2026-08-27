import { isValidTimeZone } from "@/lib/notifications/userNotificationSchedule";

export function resolveBrowserTimeZone(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized && isValidTimeZone(normalized) ? normalized : null;
}

export function getPlanReminderOffsetOptions(canUseFiveMinuteReminder: boolean): number[] {
  return canUseFiveMinuteReminder ? [5, 30, 60, 120, 180] : [30, 60, 120, 180];
}

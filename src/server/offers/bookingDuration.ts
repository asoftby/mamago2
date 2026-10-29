/** One source of truth for server quote, slot preview and reservation duration. */
export type BookingDurationSettings = {
  scheduleKind: string | null;
  durationMin: number | null;
  maxExtensionHours: number;
  extensionHourPriceByn: string | null;
  extensionDiscountPercent: number;
  hasClassGroups: boolean;
};
export function durationChoices(settings: BookingDurationSettings): number[] {
  const base = settings.durationMin;
  if (!base || !Number.isInteger(base) || base < 1 || base > 24 * 60) return [];
  const extensible = settings.scheduleKind === "ON_REQUEST_WINDOWS" &&
    !settings.hasClassGroups && settings.extensionHourPriceByn !== null &&
    Number.isInteger(settings.maxExtensionHours) && settings.maxExtensionHours > 0;
  const count = extensible ? Math.min(settings.maxExtensionHours, 8) : 0;
  return Array.from({ length: count + 1 }, (_, i) => base + i * 60);
}
export function assertBookingDuration(settings: BookingDurationSettings, minutes: number): number {
  if (!Number.isInteger(minutes) || !durationChoices(settings).includes(minutes)) {
    throw new RangeError("Выбранная продолжительность недоступна");
  }
  return (minutes - settings.durationMin!) / 60;
}

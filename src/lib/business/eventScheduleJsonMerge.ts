/**
 * Merge scheduleJson при PATCH события: форма перезаписывает только свои ключи,
 * все остальные ключи сохранённого JSON (legacy, импорт-метаданные, служебные)
 * переживают пересохранение.
 *
 * Список EVENT_FORM_MANAGED_SCHEDULE_JSON_KEYS зеркалит ключи, которые
 * mapFormDataToPayload (src/components/business/wizard/event/mappers.ts)
 * пишет в payload.scheduleJson. Управляемый ключ, отсутствующий во входящем
 * JSON, считается намеренно удалённым формой (например, cinema у не-кино
 * события) и не восстанавливается из сохранённого.
 *
 * При добавлении нового ключа в mapFormDataToPayload его нужно добавить и
 * сюда — иначе ключ будет записываться, но не будет удаляться, когда форма
 * перестанет его отправлять.
 */

export const EVENT_FORM_MANAGED_SCHEDULE_JSON_KEYS = [
  // Step 1: Basics
  "eventFormats",
  "signals",
  "subcategoryIdsByCategoryId",
  "categoryId",
  "subcategoryId",
  "categorySlug",
  "categoryPathLabel",
  "ageRangeIds",
  "ageDetection",
  "ageDetectionUserOverride",
  "ageDetectionAutoApplied",
  "genresByCategoryId",
  "durationMinutes",
  "cinema",
  // Step 3: Media
  "reelsUrl",
  // Step 4: Schedule
  "scheduleMode",
  "scheduleItems",
  "dates",
  "allDay",
  "startTime",
  "endTime",
  "repeatEnabled",
  "repeatUnit",
  "repeatUntil",
  // Step 5: Pricing & Participation
  "pricingMode",
  "priceDetails",
  "ctaStepDraft",
  "ticketLink",
  "participationMode",
  "prebookMethod",
  "prebookPhone",
  "prebookUrl",
  "simpleBookingDate",
  "simpleBookingTime",
  "simpleBookingCapacity",
  "timeSlots",
  // Step 7/8: Contacts & Organizer
  "contacts",
  "organizer",
  // Step 2: Location (черновик локации до публикации)
  "pendingLocation",
] as const;

const MANAGED_KEYS: ReadonlySet<string> = new Set(EVENT_FORM_MANAGED_SCHEDULE_JSON_KEYS);

export function mergeEventScheduleJson(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (!MANAGED_KEYS.has(key)) {
      merged[key] = value;
    }
  }
  return { ...merged, ...incoming };
}

/**
 * Срок ответа бизнеса на STANDARD-заявку (утверждён владельцем):
 * min(создание + 24 ч, начало слота − 2 ч). Без известного времени начала
 * срока нет — автоотмены тоже нет.
 */
const HOUR_MS = 3_600_000;
export const STANDARD_RESPONSE_WINDOW_MS = 24 * HOUR_MS;
export const STANDARD_RESPONSE_LEAD_MS = 2 * HOUR_MS;
const MINSK_OFFSET = "+03:00";

export interface StandardSlotStartSources {
  sessionStartsAt?: Date | null;
  offerSessionStartAt?: Date | null;
  startsAt?: Date | null;
  requestedDate?: Date | null;
  /** "HH:MM" по Минску. */
  requestedTime?: string | null;
}

/** Начало слота по приоритету: сессия → слот оффера → startsAt → дата+время (Минск). */
export function resolveStandardSlotStart(src: StandardSlotStartSources): Date | null {
  const direct = src.sessionStartsAt ?? src.offerSessionStartAt ?? src.startsAt;
  if (direct && Number.isFinite(direct.getTime())) return direct;
  const time = src.requestedTime?.trim();
  if (!src.requestedDate || !time || !/^\d{2}:\d{2}$/.test(time)) return null;
  if (!Number.isFinite(src.requestedDate.getTime())) return null;
  const start = new Date(`${src.requestedDate.toISOString().slice(0, 10)}T${time}:00${MINSK_OFFSET}`);
  return Number.isFinite(start.getTime()) ? start : null;
}

/** null — начало неизвестно, срок не ставится. */
export function standardResponseDeadline(createdAt: Date, slotStart: Date | null): Date | null {
  if (!slotStart || !Number.isFinite(slotStart.getTime())) return null;
  return new Date(Math.min(
    createdAt.getTime() + STANDARD_RESPONSE_WINDOW_MS,
    slotStart.getTime() - STANDARD_RESPONSE_LEAD_MS,
  ));
}

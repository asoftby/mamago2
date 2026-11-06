import { BookingMode } from "@prisma/client";

export type EventBookingColumns = {
  bookingEnabled: boolean;
  bookingMode: BookingMode | null;
};

/**
 * «Оставить заявку» в мастере события (`scheduleJson.participationMode === "request"`) включает серверную
 * запись: публичный API заявок принимает событие только при `bookingEnabled` (режим REQUEST_ONLY — без
 * выбора даты). Мастер больше нигде не пишет эти колонки, поэтому считаем их здесь, в одном месте.
 *
 * Возвращает патч колонок или `null`, если менять ничего не нужно:
 * - режим «заявка» → включить REQUEST_ONLY (если ещё не так);
 * - другой режим → выключить только то, что включили сами (REQUEST_ONLY). Запись, настроенная иначе
 *   (импорт, админ, слоты), не трогается.
 */
export function deriveEventRequestBookingColumns(input: {
  participationMode: unknown;
  current: EventBookingColumns;
}): EventBookingColumns | null {
  const wantsRequest = typeof input.participationMode === "string" && input.participationMode.trim() === "request";
  const { bookingEnabled, bookingMode } = input.current;
  if (wantsRequest) {
    if (bookingEnabled && bookingMode === BookingMode.REQUEST_ONLY) return null;
    return { bookingEnabled: true, bookingMode: BookingMode.REQUEST_ONLY };
  }
  if (bookingMode === BookingMode.REQUEST_ONLY) {
    return { bookingEnabled: false, bookingMode: null };
  }
  return null;
}

import { BookingMode } from "@prisma/client";
import { getEventBookingSchedule } from "./eventBookingSchedule";

export type EventBookingColumns = {
  bookingEnabled: boolean;
  bookingMode: BookingMode | null;
};

/** Sync wizard booking modes while preserving independently configured legacy modes. */
export function deriveEventRequestBookingColumns(input: {
  participationMode: unknown;
  previousParticipationMode?: unknown;
  scheduleJson?: unknown;
  current: EventBookingColumns;
  /** У события есть бизнес-получатель заявок. Без него запись включать нельзя: сервер отклонит заявку. */
  hasBusiness: boolean;
}): EventBookingColumns | null {
  const mode = typeof input.participationMode === "string" ? input.participationMode.trim() : null;
  const { bookingEnabled, bookingMode } = input.current;
  const hasSlots = getEventBookingSchedule(input.scheduleJson).size > 0;
  let nextMode: BookingMode | null = null;
  if (input.hasBusiness) {
    if (mode === "request" || (mode === "simple-booking" && !hasSlots)) {
      nextMode = BookingMode.REQUEST_ONLY;
    } else if ((mode === "time-slots" || mode === "simple-booking") && hasSlots) {
      nextMode = BookingMode.USE_PUBLICATION_SLOTS;
    }
  }
  if (nextMode) {
    return bookingEnabled && bookingMode === nextMode ? null : { bookingEnabled: true, bookingMode: nextMode };
  }
  if (bookingMode === BookingMode.REQUEST_ONLY ||
      input.previousParticipationMode === "time-slots" || input.previousParticipationMode === "simple-booking") {
    return bookingEnabled || bookingMode ? { bookingEnabled: false, bookingMode: null } : null;
  }
  return null;
}

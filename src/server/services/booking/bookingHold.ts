import { BookingStatus } from "@prisma/client";

/** A slot hold is a time-limited guarantee, even when it has no BookingAllocation (group seats). */
export class BookingHoldExpiredError extends Error {
  constructor() {
    super("Срок резерва истёк. Выберите свободное время заново.");
    this.name = "BookingHoldExpiredError";
  }
}

export function assertActiveBookingHold(
  newStatus: BookingStatus,
  holdUntil: Date | null,
  checkedAt: Date,
): void {
  if (newStatus === BookingStatus.CONFIRMED &&
      holdUntil !== null && holdUntil <= checkedAt) {
    throw new BookingHoldExpiredError();
  }
}

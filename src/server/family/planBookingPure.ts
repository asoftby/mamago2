/**
 * Family Core M6: pure rules for linking bookings to plan items and for the
 * safe booking state shown to other adults of the family (no contacts).
 */

export type PlanBookingStatus = "NEW" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "COMPLETED";

export type PlanBookingState = {
  status: PlanBookingStatus;
  label: string;
  /** YYYY-MM-DD of the requested date, if any. */
  requestedDate: string | null;
  requestedTime: string | null;
  /** True for the adult who made the booking: only they may manage it. */
  isMine: boolean;
  /** Display name of the adult who booked (null for own bookings and when unknown). */
  bookedByName: string | null;
};

export function bookingStatusLabel(status: PlanBookingStatus): string {
  switch (status) {
    case "NEW":
      return "Забронировано, ждём подтверждения";
    case "CONFIRMED":
      return "Подтверждено";
    case "COMPLETED":
      return "Состоялось";
    case "REJECTED":
      return "Бронь отклонена";
    case "CANCELLED":
      return "Бронь отменена";
  }
}

const ACTIVE: ReadonlySet<PlanBookingStatus> = new Set(["NEW", "CONFIRMED", "COMPLETED"]);

export type BookingRow = { status: PlanBookingStatus; createdAt: Date };

/** The booking to show for a plan item: newest active one, else the newest of any kind. */
export function pickBookingToShow<T extends BookingRow>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  const byNewest = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return byNewest.find((r) => ACTIVE.has(r.status)) ?? byNewest[0];
}

export type AutoLinkCandidate = { id: string; date: string | null; hasActiveBooking: boolean };

/**
 * Auto-link a new booking to a plan item only when it is unambiguous: exactly one
 * not-yet-booked candidate (matching the requested date when there is one).
 */
export function pickAutoLinkCandidate(
  candidates: AutoLinkCandidate[],
  requestedDate: string | null,
): string | null {
  const open = candidates.filter(
    (c) => !c.hasActiveBooking && (!requestedDate || c.date === requestedDate),
  );
  return open.length === 1 ? open[0].id : null;
}

export function toDateOnly(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** One line for the plan card: status, plus who booked when it is another adult. */
export function bookingCaption(state: PlanBookingState): string {
  const when = state.requestedTime ? ` · ${state.requestedTime}` : "";
  const who = !state.isMine ? ` · бронь: ${state.bookedByName ?? "другой взрослый"}` : "";
  return `${state.label}${when}${who}`;
}

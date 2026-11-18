/**
 * Shared service-end resolver for booking inbox, privacy and Direct.
 * Keep the same lifecycle semantics across all business-facing surfaces.
 * Date-only bookings stay actionable through the end of their Minsk day.
 */
export type BookingServiceEndSource = {
  endsAt?: Date | null;
  startsAt?: Date | null;
  requestedDate?: Date | null;
  campShiftDateTo?: Date | null;
  session?: { startsAt: Date } | null;
  offerSession?: { startAt: Date | null; endAt: Date | null } | null;
  partyOrderItem?: {
    partyOrder: { eventDate: Date | null; timeTo: string | null };
  } | null;
};

function minskEndOfDay(date: Date | null | undefined): Date | null {
  if (!date) return null;
  return new Date(date.toISOString().slice(0, 10) + "T23:59:59.999+03:00");
}

export function resolveBookingServiceEnd(row: BookingServiceEndSource): Date | null {
  const party = row.partyOrderItem?.partyOrder;
  const partyEnd = party?.eventDate && party.timeTo
    ? new Date(party.eventDate.toISOString().slice(0, 10) + "T" + party.timeTo + ":00+03:00")
    : null;
  return row.endsAt ?? partyEnd ??
    row.offerSession?.endAt ??
    minskEndOfDay(row.campShiftDateTo ?? row.requestedDate ??
      party?.eventDate ?? row.session?.startsAt ??
      row.offerSession?.startAt ?? row.startsAt);
}

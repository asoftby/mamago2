/**
 * Business-facing booking projections. The list must not become an exportable
 * customer database. Only an explicitly opened, actionable order may reveal
 * minimum contact details; history remains available without personal contacts.
 *
 * Business membership/tenant authorization occurs before this projection.
 */
import { BookingStatus } from "@prisma/client";
import type { BusinessBookingItem } from "./bookingQuery.service";

const ACTIVE_CONTACT_STATUSES = new Set<BookingStatus>([
  BookingStatus.NEW,
  BookingStatus.CONFIRMED,
]);

/** Terminal bookings and elapsed services must not disclose contact details,
 * even if their database status has not yet transitioned from CONFIRMED. */
function canRevealBusinessBookingContacts(booking: BusinessBookingItem, now: Date = new Date()): boolean {
  if (!ACTIVE_CONTACT_STATUSES.has(booking.status)) return false;
  if (booking.endsAt) {
    const endTimestamp = new Date(booking.endsAt).getTime();
    return Number.isFinite(endTimestamp) && endTimestamp > now.getTime();
  }
  // Undated enquiries are still operational briefly, but a stale status
  // cannot authorize harvesting contacts indefinitely.
  const created = new Date(booking.createdAt).getTime();
  const elapsed = now.getTime() - created;
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 30 * 86_400_000;
}

function removePersonalFields(booking: BusinessBookingItem): BusinessBookingItem {
  return {
    ...booking,
    customerName: "Клиент",
    customerPhone: "",
    customerEmail: null,
    customerComment: null,
    childName: null,
    childAge: null,
    participantChildren: booking.participantChildren.map((child) => ({ ...child, name: null })),
    participantsOutsideAge: booking.participantsOutsideAge.map((child) => ({ ...child, name: null })),
    display: { ...booking.display, meta: null },
    // Price snapshots are potentially unstructured JSON; never put them in a
    // bulk list response unless their contents have a dedicated PII audit.
    bookingPriceSnapshot: null,
  };
}

/** Bulk list, calendar and list-backed client state contain no direct contact. */
export function businessBookingListProjection(booking: BusinessBookingItem): BusinessBookingItem {
  return removePersonalFields(booking);
}

/**
 * An individual booking may reveal phone/name for fulfilment while actionable.
 * Email is not needed for Direct and is not exposed through this endpoint.
 * Even the single-order archive uses a minimal pseudonymous record.
 */
export function businessBookingDetailProjection(booking: BusinessBookingItem): BusinessBookingItem {
  if (!canRevealBusinessBookingContacts(booking)) return removePersonalFields(booking);
  return { ...booking, customerEmail: null };
}

/** True only when disclosure is possible and must be audited before response. */
export function businessBookingDetailRevealsContact(booking: BusinessBookingItem): boolean {
  // The active detail may contain free-text comments or child details even if
  // phone/name are empty. Audit every active detail disclosure, not just phone.
  return canRevealBusinessBookingContacts(booking);
}

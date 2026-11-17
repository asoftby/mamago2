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
  if (!ACTIVE_CONTACT_STATUSES.has(booking.status)) return removePersonalFields(booking);
  return { ...booking, customerEmail: null };
}

/** True only when disclosure is possible and must be audited before response. */
export function businessBookingDetailRevealsContact(booking: BusinessBookingItem): boolean {
  // The active detail may contain free-text comments or child details even if
  // phone/name are empty. Audit every active detail disclosure, not just phone.
  return ACTIVE_CONTACT_STATUSES.has(booking.status);
}

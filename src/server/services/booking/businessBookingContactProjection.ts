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
  // A business rejection can be reconsidered if another visitor cancels.
  // Single-order access remains tenant-scoped, audited, rate-limited, and
  // ends with the service date (or after 30 days for undated enquiries).
  BookingStatus.REJECTED,
]);

/** Contacts remain actionable during the service window (including a business
 * rejection), but completed, user-cancelled and elapsed orders stay hidden. */
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
    // Rejection reasons are free text and may accidentally contain PII.
    // Do not expose them in bulk views or expired individual details.
    rejectionReason: null,
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
export interface BusinessBookingDetailDisclosure {
  detail: BusinessBookingItem;
  revealsContact: boolean;
}

/**
 * Atomic response policy: both the projected fields and the mandatory
 * disclosure audit/rate-limit gate consume this same decision. Do not
 * recalculate visibility after building a potentially sensitive response.
 */
export function projectBusinessBookingDetailWithDisclosure(
  booking: BusinessBookingItem,
  now: Date = new Date(),
): BusinessBookingDetailDisclosure {
  const revealsContact = canRevealBusinessBookingContacts(booking, now);
  return {
    detail: revealsContact ? { ...booking, customerEmail: null } : removePersonalFields(booking),
    revealsContact,
  };
}

export function businessBookingDetailProjection(booking: BusinessBookingItem): BusinessBookingItem {
  return projectBusinessBookingDetailWithDisclosure(booking).detail;
}

/** True only when disclosure is possible and must be audited before response. */
export function businessBookingDetailRevealsContact(booking: BusinessBookingItem): boolean {
  // The active detail may contain free-text comments or child details even if
  // phone/name are empty. Audit every active detail disclosure, not just phone.
  return canRevealBusinessBookingContacts(booking);
}

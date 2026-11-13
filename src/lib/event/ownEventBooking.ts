/**
 * Event page: the signed-in user's own active booking request(s) for this event.
 *
 * PRIVATE data: only ever produced for the authenticated owner by
 * /api/save/status (no-store) and fetched client-side. It must never be part of
 * the server-rendered / shared-cache page payload.
 *
 * Extensible: only NEW / CONFIRMED are "active" for now. Other statuses (EXPIRED,
 * REJECTED, ...) are added by extending ACTIVE_BOOKING_STATUSES + STATUS_COPY.
 */
import { DEFAULT_TZ } from "@/server/geo/geoConstants";

export const ACTIVE_BOOKING_STATUSES = ["NEW", "CONFIRMED"] as const;
export type OwnEventBookingStatus = (typeof ACTIVE_BOOKING_STATUSES)[number];

export type OwnEventBooking = {
  id: string;
  status: OwnEventBookingStatus;
  /** ActivitySession id the request was made for (null for slot-less bookings). */
  sessionId: string | null;
  /** ISO moment of the booked slot. */
  at: string;
};

export function isActiveBookingStatus(status: string): status is OwnEventBookingStatus {
  return (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(status);
}

/**
 * Belarus has a fixed UTC+3 offset (no DST) — used only to turn the
 * requestedDate/requestedTime snapshot of slot-less bookings into a moment.
 */
export function bookingMomentIso(input: {
  startsAt: Date | null;
  requestedDate: Date | null;
  requestedTime: string | null;
}): string | null {
  if (input.startsAt) return input.startsAt.toISOString();
  if (!input.requestedDate) return null;
  const day = input.requestedDate.toISOString().slice(0, 10);
  const time = /^\d{2}:\d{2}$/.test(input.requestedTime ?? "") ? input.requestedTime! : "23:59";
  const d = new Date(`${day}T${time}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Nearest future booking; bookings in the past are not shown. */
export function pickDisplayedBooking(
  bookings: readonly OwnEventBooking[],
  now: Date,
): OwnEventBooking | null {
  const future = bookings
    .filter((b) => new Date(b.at).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return future[0] ?? null;
}

/** The booking made for exactly this session (a confirmed one wins over a new one). */
export function bookingForSession(
  bookings: readonly OwnEventBooking[],
  sessionId: string,
): OwnEventBooking | null {
  const own = bookings.filter((b) => b.sessionId === sessionId);
  return own.find((b) => b.status === "CONFIRMED") ?? own[0] ?? null;
}

export function formatBookingMoment(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: DEFAULT_TZ });
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_TZ });
  return `${date}, ${time}`;
}

const STATUS_COPY: Record<OwnEventBookingStatus, { head: string; tail: string }> = {
  NEW: { head: "Запись оставлена", tail: " — ждём подтверждения" },
  CONFIRMED: { head: "Запись подтверждена", tail: "" },
};

/** «Запись оставлена · 16 ноября, 10:00 — ждём подтверждения». */
export function bookingStateText(booking: OwnEventBooking): string {
  const c = STATUS_COPY[booking.status];
  return `${c.head} · ${formatBookingMoment(booking.at)}${c.tail}`;
}

/** Short variant for the narrow sticky bar. */
export function bookingStateShortText(booking: OwnEventBooking): string {
  return STATUS_COPY[booking.status].head;
}

export const MY_BOOKINGS_HREF = "/me/bookings";

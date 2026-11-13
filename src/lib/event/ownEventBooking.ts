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
  /**
   * ISO moment of the booked slot; null for requests without any date
   * (REQUEST_ONLY / internal pre-booking). For date-only bookings (no time) this is
   * the END of that day — a filtering threshold only, never shown as a time.
   */
  at: string | null;
  /** False for date-only / dateless bookings: do not display a time. */
  hasTime: boolean;
};

export function isActiveBookingStatus(status: string): status is OwnEventBookingStatus {
  return (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(status);
}

/**
 * Belarus has a fixed UTC+3 offset (no DST) — used only to turn the
 * requestedDate/requestedTime snapshot of slot-less bookings into a moment.
 * A date without time keeps `hasTime: false` (USE_PUBLICATION_DATES stores it so
 * on purpose); a request without any date yields `at: null`.
 */
export function resolveBookingMoment(input: {
  startsAt: Date | null;
  requestedDate: Date | null;
  requestedTime: string | null;
}): { at: string | null; hasTime: boolean } {
  if (input.startsAt) return { at: input.startsAt.toISOString(), hasTime: true };
  if (!input.requestedDate) return { at: null, hasTime: false };
  const day = input.requestedDate.toISOString().slice(0, 10);
  const hasTime = /^\d{2}:\d{2}$/.test(input.requestedTime ?? "");
  const d = new Date(`${day}T${hasTime ? input.requestedTime : "23:59"}:00+03:00`);
  if (Number.isNaN(d.getTime())) return { at: null, hasTime: false };
  return { at: d.toISOString(), hasTime };
}

/**
 * Nearest future dated booking; a dateless active request is kept (shown only when
 * there is no dated one). Past bookings are not shown.
 */
export function pickDisplayedBooking(
  bookings: readonly OwnEventBooking[],
  now: Date,
): OwnEventBooking | null {
  const dated = bookings
    .filter((b) => b.at !== null && new Date(b.at).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());
  return dated[0] ?? bookings.find((b) => b.at === null) ?? null;
}

/** The booking made for exactly this session (a confirmed one wins over a new one). */
export function bookingForSession(
  bookings: readonly OwnEventBooking[],
  sessionId: string,
): OwnEventBooking | null {
  const own = bookings.filter((b) => b.sessionId === sessionId);
  return own.find((b) => b.status === "CONFIRMED") ?? own[0] ?? null;
}

export function formatBookingMoment(iso: string, hasTime = true): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: DEFAULT_TZ });
  if (!hasTime) return date;
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_TZ });
  return `${date}, ${time}`;
}

const STATUS_COPY: Record<OwnEventBookingStatus, { head: string; tail: string }> = {
  NEW: { head: "Запись оставлена", tail: " — ждём подтверждения" },
  CONFIRMED: { head: "Запись подтверждена", tail: "" },
};

const DATELESS_COPY: Record<OwnEventBookingStatus, string> = {
  NEW: "Заявка отправлена",
  CONFIRMED: "Заявка подтверждена",
};

/** «Запись оставлена · 16 ноября, 10:00 — ждём подтверждения»; dateless: «Заявка отправлена — ждём подтверждения». */
export function bookingStateText(booking: OwnEventBooking): string {
  const c = STATUS_COPY[booking.status];
  if (booking.at === null) return `${DATELESS_COPY[booking.status]}${c.tail}`;
  return `${c.head} · ${formatBookingMoment(booking.at, booking.hasTime)}${c.tail}`;
}

/** Short variant for the narrow sticky bar. */
export function bookingStateShortText(booking: OwnEventBooking): string {
  return booking.at === null ? DATELESS_COPY[booking.status] : STATUS_COPY[booking.status].head;
}

export const MY_BOOKINGS_HREF = "/me/bookings";

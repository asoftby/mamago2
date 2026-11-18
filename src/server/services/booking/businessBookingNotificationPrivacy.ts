/**
 * BUSINESS notifications are sent outside the authenticated order-detail
 * screen (Telegram, email, in-app push). They must never carry customer or
 * child identity in either rendered body or stored templatePayload metadata.
 * Staff may inspect the specific order via its audited, ACL-gated detail API.
 */
import {
  buildBookingActorLabel, buildBookingNotificationBody,
  type BookingNotificationBodyInput,
} from "./booking.formatters";
import { resolveBookingSourceType } from "./booking.types";

export type BusinessBookingNotificationContext = {
  offerId?: string | null;
  activityId?: string | null;
  placeId?: string | null;
  campShiftId?: string | null;
  offerTitle?: string | null;
  activityTitle?: string | null;
  placeTitle?: string | null;
  campShiftTitle?: string | null;
  campShiftDateFrom?: string | null;
  campShiftDateTo?: string | null;
  // These must not leave the authenticated booking service:
  customerName?: string | null;
  childName?: string | null;
  childAge?: number | null;
};

export function buildPrivateBusinessBookingNotification(context: BusinessBookingNotificationContext): {
  body: string;
  templatePayload: Record<string, string>;
} {
  const sourceType = resolveBookingSourceType({
    campShiftId: context.campShiftId ?? null,
    offerId: context.offerId ?? null,
    activityId: context.activityId ?? null,
    placeId: context.placeId ?? null,
  });
  const publicBody: BookingNotificationBodyInput = {
    sourceType,
    offerTitle: context.offerTitle ?? null,
    activityTitle: context.activityTitle ?? null,
    placeTitle: context.placeTitle ?? null,
    campShiftTitle: context.campShiftTitle ?? null,
    campShiftDateFrom: context.campShiftDateFrom ?? null,
    campShiftDateTo: context.campShiftDateTo ?? null,
    customerName: "Клиент",
    childName: null,
    childAge: null,
  };
  const body = buildBookingNotificationBody(publicBody);
  const templatePayload: Record<string, string> = {
    bookingSummary: body,
    actor: buildBookingActorLabel(publicBody),
    customerName: "Клиент",
    ...(context.offerTitle ? { offerTitle: context.offerTitle } : {}),
    ...(context.activityTitle ? { activityTitle: context.activityTitle } : {}),
    ...(context.placeTitle ? { placeTitle: context.placeTitle } : {}),
    ...(context.campShiftTitle ? { campShiftTitle: context.campShiftTitle } : {}),
    ...(context.campShiftDateFrom ? { campShiftDateFrom: context.campShiftDateFrom } : {}),
    ...(context.campShiftDateTo ? { campShiftDateTo: context.campShiftDateTo } : {}),
  };
  return { body, templatePayload };
}

/** One shared, PII-free reminder body for the lazy UI trigger and scheduled job. */
export function buildPrivateBusinessBookingReminder(
  staleType: "BOOKING_STALE" | "BOOKING_NEEDS_ATTENTION",
  staleHours: number,
): string {
  const n = Math.max(0, Math.floor(staleHours));
  const hoursLabel = (hours: number): string =>
    hours % 10 === 1 && hours % 100 !== 11 ? "час" :
    [2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours % 100) ? "часа" : "часов";
  const daysLabel = (days: number): string =>
    days % 10 === 1 && days % 100 !== 11 ? "день" :
    [2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100) ? "дня" : "дней";

  if (staleType === "BOOKING_STALE") {
    const days = Math.floor(n / 24);
    const label = n < 48 ? `${n} ${hoursLabel(n)}` : `${days} ${daysLabel(days)}`;
    return `Новая заявка ждёт ответа уже ${label}`;
  }
  const days = Math.floor(n / 24);
  return `Подтверждённая заявка без активности ${days} ${daysLabel(days)}`;
}

/**
 * Defence in depth for retries of legacy BUSINESS notifications that were
 * persisted before push redaction. Never feed historical PII-filled metadata
 * to the template engine or fallback Telegram/email renderer.
 *
 * Existing in-app records are not rewritten here; migration is separate.
 */
export function businessBookingDeliveryProjection<T extends {
  audience: string | null;
  type: string;
  title: string;
  body: string;
  metadata: unknown;
}>(notice: T): T {
  if (notice.audience !== "BUSINESS") return notice;
  // Party Outbox already uses the non-identifying actor "Семья" and is
  // independently authorized. Its source/outboxId metadata is REQUIRED to
  // build the signed Telegram confirmation keyboard. Do not strip it here.
  const meta = notice.metadata;
  if (notice.type === "BOOKING_CREATED" &&
      meta && typeof meta === "object" && !Array.isArray(meta) &&
      "source" in meta && meta.source === "PARTY_OUTBOX") {
    return notice;
  }
  const safe: Record<string, { title: string; body: string }> = {
    BOOKING_CREATED: {
      title: "Новая заявка",
      body: "Поступила новая заявка. Откройте её в mamaGo для обработки.",
    },
    BOOKING_STALE: {
      title: "Заявка ждёт ответа",
      body: "Заявка ожидает ответа. Откройте её в mamaGo.",
    },
    BOOKING_NEEDS_ATTENTION: {
      title: "Требует внимания",
      body: "Подтверждённая заявка требует внимания. Откройте её в mamaGo.",
    },
  };
  const message = safe[notice.type];
  if (!message) return notice;
  // There is deliberately no legacy metadata.templatePayload here:
  // it may include customerName, childName and other free-form personal data.
  return { ...notice, title: message.title, body: message.body, metadata: null };
}

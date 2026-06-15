/**
 * Booking Formatters
 *
 * Чистые функции для построения display-объектов из данных BookingRequest.
 * Не зависят от Prisma, React или внешних сервисов.
 * Используются в:
 *   - bookingQuery.service.ts (API DTO)
 *   - notification.service.ts (notification body)
 *   - BookingCard.tsx (UI rendering)
 */

import type { BookingDisplay, BookingSourceType } from "./booking.types";
import { resolveBookingSourceType } from "./booking.types";

// ─── Date formatting ──────────────────────────────────────────────────────────

const MONTHS_SHORT_RU = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

export function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS_SHORT_RU[d.getMonth()]}`;
  } catch {
    return iso;
  }
}

export function fmtDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  if (from && to) return `${fmtShortDate(from)} — ${fmtShortDate(to)}`;
  if (from) return `с ${fmtShortDate(from)}`;
  if (to) return `до ${fmtShortDate(to)}`;
  return "";
}

// ─── Type labels ──────────────────────────────────────────────────────────────

const SOURCE_TYPE_LABEL: Record<BookingSourceType, string> = {
  CAMP_SHIFT: "Лагерь",
  OFFER: "Предложение",
  EVENT: "Событие",
  PLACE: "Место",
  UNKNOWN: "Заявка",
};

export function getBookingTypeLabel(sourceType: BookingSourceType): string {
  return SOURCE_TYPE_LABEL[sourceType];
}

// ─── Display builder ──────────────────────────────────────────────────────────

export interface BookingDisplayInput {
  campShiftId: string | null;
  campShiftTitle: string | null;
  campShiftDateFrom: string | null;
  campShiftDateTo: string | null;
  offerId: string | null;
  activityId: string | null;
  placeId: string | null;
  offer: { title: string } | null;
  activity: { title: string } | null;
  place: { title: string } | null;
  childName: string | null;
  childAge: number | null;
  customerName: string;
  requestedDate: string | null;
  requestedTime: string | null;
  session: { startsAt: string } | null;
}

/**
 * Строит нормализованный display-объект из полей BookingRequest.
 * Единственное место, где знает о campShift, session, requestedDate.
 */
export function buildBookingDisplay(input: BookingDisplayInput): BookingDisplay {
  const sourceType = resolveBookingSourceType(input);

  switch (sourceType) {
    case "CAMP_SHIFT":
      return buildCampShiftDisplay(input);
    case "OFFER":
      return buildOfferDisplay(input);
    case "EVENT":
      return buildEventDisplay(input);
    case "PLACE":
      return buildPlaceDisplay(input);
    default:
      return {
        title: "Заявка",
        subtitle: null,
        meta: null,
        typeLabel: "Заявка",
        sourceType: "UNKNOWN",
      };
  }
}

// ─── Source-specific builders ─────────────────────────────────────────────────

function buildCampShiftDisplay(input: BookingDisplayInput): BookingDisplay {
  const title = input.offer?.title ?? "Лагерь";

  // Subtitle: shift title + dates
  const datePart = fmtDateRange(input.campShiftDateFrom, input.campShiftDateTo);
  const subtitle = input.campShiftTitle
    ? datePart
      ? `${input.campShiftTitle} · ${datePart}`
      : input.campShiftTitle
    : datePart || null;

  // Meta: child info
  const meta = buildChildMeta(input.childName, input.childAge);

  return {
    title,
    subtitle,
    meta,
    typeLabel: "Лагерь",
    sourceType: "CAMP_SHIFT",
  };
}

function buildOfferDisplay(input: BookingDisplayInput): BookingDisplay {
  const title = input.offer?.title ?? "Предложение";
  const subtitle = buildDateTimeMeta(input.requestedDate, input.requestedTime);
  const meta = buildChildMeta(input.childName, input.childAge);

  return {
    title,
    subtitle,
    meta,
    typeLabel: "Предложение",
    sourceType: "OFFER",
  };
}

function buildEventDisplay(input: BookingDisplayInput): BookingDisplay {
  const title = input.activity?.title ?? "Событие";
  const subtitle = input.session
    ? fmtEventDateTime(input.session.startsAt)
    : buildDateTimeMeta(input.requestedDate, input.requestedTime);

  return {
    title,
    subtitle,
    meta: null,
    typeLabel: "Событие",
    sourceType: "EVENT",
  };
}

function buildPlaceDisplay(input: BookingDisplayInput): BookingDisplay {
  const title = input.place?.title ?? "Место";
  const subtitle = buildDateTimeMeta(input.requestedDate, input.requestedTime);

  return {
    title,
    subtitle,
    meta: null,
    typeLabel: "Место",
    sourceType: "PLACE",
  };
}

// ─── Shared meta helpers ──────────────────────────────────────────────────────

function buildChildMeta(
  childName: string | null | undefined,
  childAge: number | null | undefined,
): string | null {
  if (!childName && childAge == null) return null;
  const parts: string[] = [];
  if (childName) parts.push(childName);
  if (childAge != null) parts.push(`${childAge} лет`);
  return parts.join(", ");
}

function buildDateTimeMeta(
  date: string | null | undefined,
  time: string | null | undefined,
): string | null {
  if (!date) return null;
  const datePart = fmtShortDate(date);
  return time ? `${datePart}, ${time}` : datePart;
}

function fmtEventDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const month = MONTHS_SHORT_RU[d.getMonth()];
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${day} ${month}, ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

// ─── Notification body builder ────────────────────────────────────────────────

export interface BookingNotificationBodyInput {
  sourceType: BookingSourceType;
  offerTitle: string | null;
  activityTitle: string | null;
  placeTitle: string | null;
  campShiftTitle: string | null;
  campShiftDateFrom: string | null;
  campShiftDateTo: string | null;
  customerName: string;
  childName: string | null;
  childAge: number | null;
}

/**
 * Строит тело уведомления BOOKING_CREATED.
 * Не зависит от лагерь-специфичных assumptions.
 *
 * Примеры:
 *   CAMP_SHIFT: "Маша (7 лет) записалась на смену «11–17 мая»"
 *   EVENT:      "Иван Петров оставил заявку на «Мастер-класс»"
 *   OFFER:      "Анна оставила заявку на «Английский язык»"
 */
/** «Имя ребёнка (N лет)» либо имя клиента — переиспользуется шаблонами уведомлений. */
export function buildBookingActorLabel(
  input: Pick<BookingNotificationBodyInput, "customerName" | "childName" | "childAge">,
): string {
  return input.childName
    ? input.childAge != null
      ? `${input.childName} (${input.childAge} лет)`
      : input.childName
    : input.customerName;
}

export function buildBookingNotificationBody(
  input: BookingNotificationBodyInput,
): string {
  const actor = buildBookingActorLabel(input);

  switch (input.sourceType) {
    case "CAMP_SHIFT": {
      const shiftLabel =
        input.campShiftTitle ||
        fmtDateRange(input.campShiftDateFrom, input.campShiftDateTo);
      return shiftLabel
        ? `${actor} записался на смену «${shiftLabel}»`
        : `${actor} оставил заявку на «${input.offerTitle ?? "лагерь"}»`;
    }
    case "EVENT":
      return `${actor} оставил заявку на «${input.activityTitle ?? "событие"}»`;
    case "PLACE":
      return `${actor} оставил заявку на посещение «${input.placeTitle ?? "место"}»`;
    case "OFFER":
    default:
      return `${actor} оставил заявку на «${input.offerTitle ?? "предложение"}»`;
  }
}

/**
 * Booking Domain Types
 *
 * Единая типизация booking-domain.
 * Не зависит от Prisma напрямую — только от BookingStatus enum.
 */

import type { BookingStatus } from "@prisma/client";

// ─── Booking source type ──────────────────────────────────────────────────────

/**
 * Тип источника заявки — определяет, к чему привязана заявка.
 * Не хранится в БД отдельным полем — вычисляется из данных BookingRequest.
 *
 * CAMP_SHIFT  — смена лагеря (offerId + campShiftId)
 * OFFER       — обычное предложение (offerId, без смены)
 * EVENT       — событие (activityId)
 * PLACE       — место (placeId)
 */
export type BookingSourceType =
  | "CAMP_SHIFT"
  | "OFFER"
  | "EVENT"
  | "PLACE"
  | "UNKNOWN";

/**
 * Определяет тип источника из полей BookingRequest.
 * Чистая функция — без side effects.
 */
export function resolveBookingSourceType(booking: {
  campShiftId: string | null;
  offerId: string | null;
  activityId: string | null;
  placeId: string | null;
}): BookingSourceType {
  if (booking.campShiftId && booking.offerId) return "CAMP_SHIFT";
  if (booking.offerId) return "OFFER";
  if (booking.activityId) return "EVENT";
  if (booking.placeId) return "PLACE";
  return "UNKNOWN";
}

// ─── Display DTO ──────────────────────────────────────────────────────────────

/**
 * Нормализованный display-объект для UI.
 * Вычисляется из BookingRequest — UI не должен знать о campShift напрямую.
 */
export interface BookingDisplay {
  /** Основной заголовок: название предложения/события/места */
  title: string;
  /** Подзаголовок: смена, дата, слот */
  subtitle: string | null;
  /** Метаданные: возраст, длительность и т.д. */
  meta: string | null;
  /** Человекочитаемый тип: "Лагерь", "Событие", "Предложение", "Место" */
  typeLabel: string;
  /** Тип источника для условного рендеринга */
  sourceType: BookingSourceType;
}

// ─── Customer DTO ─────────────────────────────────────────────────────────────

export interface BookingCustomer {
  name: string;
  phone: string;
  email: string | null;
  comment: string | null;
  childName: string | null;
  childAge: number | null;
}

// ─── Full normalized booking DTO ──────────────────────────────────────────────

/**
 * Полный нормализованный DTO заявки для бизнес-кабинета.
 * Расширяет BusinessBookingItem, добавляя вычисленные поля.
 */
export interface NormalizedBooking {
  id: string;
  status: BookingStatus;
  createdAt: string;
  display: BookingDisplay;
  customer: BookingCustomer;
}

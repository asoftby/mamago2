/**
 * Booking Service
 * Создание и управление заявками на запись (BookingRequest).
 *
 * Поддерживает:
 * - Заявки на смены лагеря (offerId + campShiftId)
 * - Заявки на обычные предложения (offerId)
 * - Заявки на события (activityId)
 * - Заявки на места (placeId)
 */

import prisma from "@/lib/prisma";
import { BookingStatus, PublicationType } from "@prisma/client";
import { notifyBookingCreated } from "@/server/services/notification.service";
import { recordBookingCreated } from "./bookingActivity.service";
import { trackBookingCreated } from "@/server/analytics/trackBookingEvent";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampShiftSnapshot {
  /** ID смены из JSON-массива Offer.campSessions */
  id: string;
  title?: string | null;
  dateFrom?: string | Date | null;
  dateTo?: string | Date | null;
}

export interface CreateCampShiftBookingInput {
  offerId: string;
  /** Snapshot выбранной смены */
  campShift: CampShiftSnapshot;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  /** Имя ребёнка */
  childName?: string | null;
  /** Возраст ребёнка (полных лет) */
  childAge?: number | null;
  comment?: string | null;
  /** Если пользователь авторизован */
  userId?: string | null;
}

export interface CreateBookingResult {
  bookingId: string;
  status: BookingStatus;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

function validatePhone(phone: string): boolean {
  return PHONE_RE.test(phone.trim());
}

// ─── Camp shift booking ───────────────────────────────────────────────────────

/**
 * Создаёт заявку на конкретную смену лагеря.
 *
 * Проверяет:
 * 1. Offer существует и опубликован
 * 2. Offer является лагерем (campProgramType задан)
 * 3. Смена с переданным id присутствует в Offer.campSessions
 * 4. Обязательные поля заполнены
 *
 * Не списывает места (capacity check — фаза 2).
 */
export async function createCampShiftBooking(
  input: CreateCampShiftBookingInput,
): Promise<CreateBookingResult> {
  // ── 1. Валидация обязательных полей ──
  const name = input.customerName.trim();
  const phone = input.customerPhone.trim();

  if (!name) {
    throw new BookingValidationError("customerName", "Имя обязательно");
  }
  if (!phone) {
    throw new BookingValidationError("customerPhone", "Телефон обязателен");
  }
  if (!validatePhone(phone)) {
    throw new BookingValidationError("customerPhone", "Некорректный формат телефона");
  }
  if (!input.campShift.id) {
    throw new BookingValidationError("campShiftId", "Не выбрана смена");
  }

  // ── 2. Загружаем Offer ──
  const offer = await prisma.offer.findUnique({
    where: { id: input.offerId },
    select: {
      id: true,
      title: true,
      status: true,
      campProgramType: true,
      campSessions: true,
      placeId: true,
      place: {
        select: {
          ownerBusinessId: true,
          cityId: true,
        },
      },
    },
  });

  if (!offer) {
    throw new BookingNotFoundError("Предложение не найдено");
  }
  if (offer.status !== "PUBLISHED") {
    throw new BookingNotFoundError("Предложение недоступно для записи");
  }
  if (!offer.campProgramType) {
    throw new BookingValidationError("offerId", "Предложение не является лагерем");
  }

  const businessId = offer.place?.ownerBusinessId;
  if (!businessId) {
    throw new BookingValidationError("offerId", "Бизнес-аккаунт не найден для этого предложения");
  }

  // ── 3. Проверяем смену ──
  const sessions = parseCampSessions(offer.campSessions);
  const shift = sessions.find((s) => s.id === input.campShift.id);

  if (!shift) {
    throw new BookingValidationError(
      "campShiftId",
      `Смена с id "${input.campShift.id}" не найдена в этом предложении`,
    );
  }

  // ── 4. Snapshot дат смены (из БД, не из input — защита от подмены) ──
  const shiftDateFrom = shift.dateFrom ? new Date(shift.dateFrom) : null;
  const shiftDateTo = shift.dateTo ? new Date(shift.dateTo) : null;

  // ── 5. TODO (фаза 2): проверка capacity ──
  // if (shift.capacity != null) {
  //   const existingCount = await prisma.bookingRequest.count({
  //     where: { offerId: input.offerId, campShiftId: input.campShift.id,
  //              status: { notIn: [BookingStatus.REJECTED, BookingStatus.CANCELLED] } },
  //   });
  //   if (existingCount >= shift.capacity) throw new BookingCapacityError();
  // }

  // ── 6. Создаём заявку ──
  const booking = await prisma.bookingRequest.create({
    data: {
      businessId,
      userId: input.userId ?? undefined,
      publicationType: PublicationType.OFFER,
      offerId: input.offerId,

      // Смена
      campShiftId: input.campShift.id,
      campShiftTitle: shift.title ?? input.campShift.title ?? null,
      campShiftDateFrom: shiftDateFrom,
      campShiftDateTo: shiftDateTo,

      // Клиент
      customerName: name,
      customerPhone: phone,
      customerEmail: input.customerEmail?.trim() || null,
      customerComment: input.comment?.trim() || null,

      // Ребёнок
      childName: input.childName?.trim() || null,
      childAge: input.childAge ?? null,

      status: BookingStatus.NEW,
    },
    select: { id: true, status: true },
  });

  // ── Fire-and-forget: activity + notification + analytics ──
  recordBookingCreated(booking.id);

  void trackBookingCreated({
    userId: input.userId ?? null,
    bookingId: booking.id,
    entityType: "OFFER",
    entityId: input.offerId,
    vertical: "CITY",
    cityId: offer.place?.cityId ?? null,
    metadata: {
      status: booking.status,
      shiftId: input.campShift.id,
      shiftTitle: shift.title ?? null,
      source: "detail",
      surface: "web",
    },
  });

  prisma.business
    .findUnique({ where: { id: businessId }, select: { ownerUserId: true } })
    .then((business) => {
      if (!business?.ownerUserId) return;
      return notifyBookingCreated({
        ownerUserId: business.ownerUserId,
        bookingId: booking.id,
        offerId: input.offerId,
        offerTitle: offer.title ?? "",
        campShiftId: input.campShift.id,
        campShiftTitle: shift.title ?? null,
        campShiftDateFrom: shiftDateFrom?.toISOString() ?? null,
        campShiftDateTo: shiftDateTo?.toISOString() ?? null,
        customerName: name,
        childName: input.childName?.trim() || null,
        childAge: input.childAge ?? null,
      });
    })
    .catch((err) =>
      console.error("[createCampShiftBooking] notifyBookingCreated failed:", err),
    );

  return { bookingId: booking.id, status: booking.status };
}


// ─── Error classes ────────────────────────────────────────────────────────────

export class BookingValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "BookingValidationError";
  }
}

export class BookingNotFoundError extends Error {
  constructor(message = "Не найдено") {
    super(message);
    this.name = "BookingNotFoundError";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface RawCampSession {
  id?: string;
  title?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  capacity?: number | null;
  spotsLeft?: number | null;
  [key: string]: unknown;
}

/**
 * Парсит Offer.campSessions JSON в типизированный массив.
 * Генерирует id из индекса если не задан.
 */
function parseCampSessions(raw: unknown): Array<RawCampSession & { id: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item, idx) => ({
      ...item,
      id: typeof item.id === "string" && item.id ? item.id : String(idx),
    }));
}

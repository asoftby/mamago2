/**
 * Booking Service
 * Единый command-layer для создания заявок на запись (BookingRequest).
 *
 * Поддерживает:
 * - Заявки на смены лагеря (offerId + campShiftId)
 * - Заявки на обычные предложения (offerId)
 * - Заявки на события (activityId)
 * - Заявки на места (placeId)
 */

import prisma from "@/lib/prisma";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";
import {
  BookingMode,
  BookingStatus,
  Prisma,
  PublicationType,
} from "@prisma/client";
import { notifyBookingCreated } from "@/server/services/notification.service";
import { trackBookingCreated } from "@/server/analytics/trackBookingEvent";
import {
  getPublicActivityDetailWhere,
  getPublicPublishedOfferWhere,
  getPublicPublishedPlaceWhere,
} from "@/server/public/publicContentVisibility";

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

export interface CreatePublicBookingInput {
  publicationType: PublicationType;
  publicationId: string;
  selectedSessionId?: string | null;
  requestedDate?: string | Date | null;
  requestedTime?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerComment?: string | null;
  adultsCount?: number;
  childrenCount?: number;
  userId?: string | null;
}

export interface CreateBookingResult {
  bookingId: string;
  status: BookingStatus;
}

interface BookingSideEffectsContext {
  bookingId: string;
  userId: string | null;
  entityType: "EVENT" | "OFFER" | "PLACE";
  entityId: string;
  entityTitle: string | null;
  cityId: string | null;
  ownerUserId: string | null;
  customerName: string;
  childName?: string | null;
  childAge?: number | null;
  offerId?: string | null;
  offerTitle?: string | null;
  activityId?: string | null;
  activityTitle?: string | null;
  placeId?: string | null;
  placeTitle?: string | null;
  campShiftId?: string | null;
  campShiftTitle?: string | null;
  campShiftDateFrom?: Date | null;
  campShiftDateTo?: Date | null;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

function validatePhone(phone: string): boolean {
  return PHONE_RE.test(phone.trim());
}

function normalizeRequiredString(value: string, field: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new BookingValidationError(field, message);
  }
  return normalized;
}

function normalizeOptionalString(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeRequestedDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BookingValidationError("requestedDate", "Некорректная дата");
  }
  return parsed;
}

function validateBookingCustomer(input: {
  customerName: string;
  customerPhone: string;
}) {
  const customerName = normalizeRequiredString(
    input.customerName,
    "customerName",
    "Имя обязательно",
  );
  const customerPhone = normalizeRequiredString(
    input.customerPhone,
    "customerPhone",
    "Телефон обязателен",
  );

  if (!validatePhone(customerPhone)) {
    throw new BookingValidationError("customerPhone", "Некорректный формат телефона");
  }

  return { customerName, customerPhone };
}

async function createBookingWithInitialActivity(
  data: Prisma.BookingRequestUncheckedCreateInput,
): Promise<CreateBookingResult> {
  const now = new Date();

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.bookingRequest.create({
      data: {
        ...data,
        lastActivityAt: now,
      },
      select: {
        id: true,
        status: true,
      },
    });

    await tx.bookingActivity.create({
      data: {
        bookingId: created.id,
        type: "CREATED",
        actorType: "SYSTEM",
        payload: Prisma.JsonNull,
        createdAt: now,
      },
    });

    return created;
  });

  return {
    bookingId: booking.id,
    status: booking.status,
  };
}

function triggerBookingCreatedSideEffects(context: BookingSideEffectsContext): void {
  void trackBookingCreated({
    userId: context.userId,
    bookingId: context.bookingId,
    entityType: context.entityType,
    entityId: context.entityId,
    vertical: "CITY",
    cityId: context.cityId,
    metadata: {
      status: BookingStatus.NEW,
      shiftId: context.campShiftId ?? null,
      shiftTitle: context.campShiftTitle ?? null,
      source: "detail",
      surface: "web",
    },
  });

  if (!context.ownerUserId) {
    return;
  }

  notifyBookingCreated({
    ownerUserId: context.ownerUserId,
    bookingId: context.bookingId,
    offerId: context.offerId ?? null,
    offerTitle: context.offerTitle ?? null,
    activityId: context.activityId ?? null,
    activityTitle: context.activityTitle ?? null,
    placeId: context.placeId ?? null,
    placeTitle: context.placeTitle ?? null,
    campShiftId: context.campShiftId ?? null,
    campShiftTitle: context.campShiftTitle ?? null,
    campShiftDateFrom: context.campShiftDateFrom?.toISOString() ?? null,
    campShiftDateTo: context.campShiftDateTo?.toISOString() ?? null,
    customerName: context.customerName,
    childName: context.childName ?? null,
    childAge: context.childAge ?? null,
  }).catch((err) =>
    console.error("[booking.service] notifyBookingCreated failed:", err),
  );
}

async function logBookingCreatedAudit(params: {
  bookingId: string;
  status: BookingStatus;
  actorId?: string | null;
  actorRole: string;
  publicationType: PublicationType;
  entityType: "EVENT" | "OFFER" | "PLACE";
  entityId: string;
  businessId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await logAdminAudit({
    actorId: params.actorId ?? null,
    actorRole: params.actorRole,
    action: "BOOKING_CREATED",
    entityType: "BOOKING_REQUEST",
    entityId: params.bookingId,
    before: null,
    after: {
      status: params.status,
      publicationType: params.publicationType,
      entityType: params.entityType,
      entityId: params.entityId,
      businessId: params.businessId,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail ?? null,
    },
    metadata: params.metadata ?? null,
  });
}

// ─── Generic public booking ──────────────────────────────────────────────────

/**
 * Создаёт публичную заявку для EVENT / OFFER / PLACE.
 * Все публичные write-paths должны идти через этот command-layer.
 */
export async function createPublicBooking(
  input: CreatePublicBookingInput,
): Promise<CreateBookingResult> {
  const { customerName, customerPhone } = validateBookingCustomer(input);
  const customerEmail = normalizeOptionalString(input.customerEmail);
  const customerComment = normalizeOptionalString(input.customerComment);
  const requestedDate = normalizeRequestedDate(input.requestedDate);
  const requestedTime = normalizeOptionalString(input.requestedTime);
  const adultsCount = input.adultsCount ?? 1;
  const childrenCount = input.childrenCount ?? 0;

  if (adultsCount < 0) {
    throw new BookingValidationError("adultsCount", "Количество взрослых не может быть отрицательным");
  }
  if (childrenCount < 0) {
    throw new BookingValidationError("childrenCount", "Количество детей не может быть отрицательным");
  }
  if (adultsCount + childrenCount < 1) {
    throw new BookingValidationError("adultsCount", "Нужно указать хотя бы одного участника");
  }

  if (input.selectedSessionId && input.publicationType !== PublicationType.EVENT) {
    throw new BookingValidationError(
      "selectedSessionId",
      "Слоты доступны только для событий",
    );
  }

  if (input.publicationType === PublicationType.EVENT) {
    const activity = await prisma.activity.findFirst({
      where: {
        id: input.publicationId,
        ...getPublicActivityDetailWhere(),
      },
      select: {
        id: true,
        title: true,
        cityId: true,
        placeId: true,
        bookingEnabled: true,
        bookingMode: true,
        businessId: true,
        business: {
          select: {
            ownerUserId: true,
          },
        },
      },
    });

    if (!activity) {
      throw new BookingNotFoundError("Событие недоступно для записи");
    }
    if (!activity.bookingEnabled) {
      throw new BookingValidationError("publicationId", "Запись недоступна для этого события");
    }
    if (!activity.businessId) {
      throw new BookingValidationError("publicationId", "Бизнес-аккаунт не найден для этого события");
    }
    if (activity.bookingMode === BookingMode.USE_PUBLICATION_SLOTS && !input.selectedSessionId) {
      throw new BookingValidationError("selectedSessionId", "Нужно выбрать слот");
    }
    if (activity.bookingMode === BookingMode.USE_PUBLICATION_DATES && !requestedDate) {
      throw new BookingValidationError("requestedDate", "Нужно выбрать дату");
    }

    if (input.selectedSessionId) {
      const session = await prisma.activitySession.findUnique({
        where: { id: input.selectedSessionId },
        select: { activityId: true },
      });

      if (!session || session.activityId !== activity.id) {
        throw new BookingValidationError("selectedSessionId", "Некорректный слот");
      }
    }

    const result = await createBookingWithInitialActivity({
      businessId: activity.businessId,
      userId: input.userId ?? undefined,
      publicationType: PublicationType.EVENT,
      activityId: activity.id,
      placeId: activity.placeId ?? undefined,
      selectedSessionId: input.selectedSessionId ?? undefined,
      requestedDate: requestedDate ?? undefined,
      requestedTime: requestedTime ?? undefined,
      customerName,
      customerPhone,
      customerEmail: customerEmail ?? undefined,
      customerComment: customerComment ?? undefined,
      adultsCount,
      childrenCount,
      status: BookingStatus.NEW,
    });

    triggerBookingCreatedSideEffects({
      bookingId: result.bookingId,
      userId: input.userId ?? null,
      entityType: "EVENT",
      entityId: activity.id,
      entityTitle: activity.title,
      cityId: activity.cityId ?? null,
      ownerUserId: activity.business?.ownerUserId ?? null,
      customerName,
      activityId: activity.id,
      activityTitle: activity.title,
      placeId: activity.placeId ?? null,
    });

    await logBookingCreatedAudit({
      bookingId: result.bookingId,
      status: result.status,
      actorId: input.userId ?? null,
      actorRole: input.userId ? "USER" : "ANONYMOUS",
      publicationType: PublicationType.EVENT,
      entityType: "EVENT",
      entityId: activity.id,
      businessId: activity.businessId,
      customerName,
      customerPhone,
      customerEmail,
      metadata: {
        source: "public_booking",
      },
    });

    return result;
  }

  if (input.publicationType === PublicationType.OFFER) {
    const offer = await prisma.offer.findFirst({
      where: {
        id: input.publicationId,
        ...getPublicPublishedOfferWhere(),
      },
      select: {
        id: true,
        title: true,
        bookingEnabled: true,
        bookingMode: true,
        placeId: true,
        place: {
          select: {
            cityId: true,
            ownerBusinessId: true,
            ownerBusiness: {
              select: {
                ownerUserId: true,
              },
            },
          },
        },
      },
    });

    if (!offer) {
      throw new BookingNotFoundError("Предложение недоступно для записи");
    }
    if (!offer.bookingEnabled) {
      throw new BookingValidationError("publicationId", "Запись недоступна для этого предложения");
    }
    if (!offer.place?.ownerBusinessId) {
      throw new BookingValidationError("publicationId", "Бизнес-аккаунт не найден для этого предложения");
    }
    if (offer.bookingMode === BookingMode.USE_PUBLICATION_SLOTS && !input.selectedSessionId) {
      throw new BookingValidationError("selectedSessionId", "Нужно выбрать слот");
    }
    if (offer.bookingMode === BookingMode.USE_PUBLICATION_DATES && !requestedDate) {
      throw new BookingValidationError("requestedDate", "Нужно выбрать дату");
    }
    if (input.selectedSessionId) {
      throw new BookingValidationError(
        "selectedSessionId",
        "Слоты доступны только для событий",
      );
    }

    const result = await createBookingWithInitialActivity({
      businessId: offer.place.ownerBusinessId,
      userId: input.userId ?? undefined,
      publicationType: PublicationType.OFFER,
      offerId: offer.id,
      requestedDate: requestedDate ?? undefined,
      requestedTime: requestedTime ?? undefined,
      customerName,
      customerPhone,
      customerEmail: customerEmail ?? undefined,
      customerComment: customerComment ?? undefined,
      adultsCount,
      childrenCount,
      status: BookingStatus.NEW,
    });

    triggerBookingCreatedSideEffects({
      bookingId: result.bookingId,
      userId: input.userId ?? null,
      entityType: "OFFER",
      entityId: offer.id,
      entityTitle: offer.title,
      cityId: offer.place.cityId ?? null,
      ownerUserId: offer.place.ownerBusiness?.ownerUserId ?? null,
      customerName,
      offerId: offer.id,
      offerTitle: offer.title,
    });

    await logBookingCreatedAudit({
      bookingId: result.bookingId,
      status: result.status,
      actorId: input.userId ?? null,
      actorRole: input.userId ? "USER" : "ANONYMOUS",
      publicationType: PublicationType.OFFER,
      entityType: "OFFER",
      entityId: offer.id,
      businessId: offer.place.ownerBusinessId,
      customerName,
      customerPhone,
      customerEmail,
      metadata: {
        source: "public_booking",
      },
    });

    return result;
  }

  const place = await prisma.place.findFirst({
    where: {
      id: input.publicationId,
      ...getPublicPublishedPlaceWhere(),
    },
    select: {
      id: true,
      title: true,
      cityId: true,
      bookingEnabled: true,
      ownerBusinessId: true,
      ownerBusiness: {
        select: {
          ownerUserId: true,
        },
      },
    },
  });

  if (!place) {
    throw new BookingNotFoundError("Место недоступно для записи");
  }
  if (!place.bookingEnabled) {
    throw new BookingValidationError("publicationId", "Запись недоступна для этого места");
  }
  if (!place.ownerBusinessId) {
    throw new BookingValidationError("publicationId", "Бизнес-аккаунт не найден для этого места");
  }
  if (input.selectedSessionId) {
    throw new BookingValidationError(
      "selectedSessionId",
      "Слоты доступны только для событий",
    );
  }

  const result = await createBookingWithInitialActivity({
    businessId: place.ownerBusinessId,
    userId: input.userId ?? undefined,
    publicationType: PublicationType.PLACE,
    placeId: place.id,
    requestedDate: requestedDate ?? undefined,
    requestedTime: requestedTime ?? undefined,
    customerName,
    customerPhone,
    customerEmail: customerEmail ?? undefined,
    customerComment: customerComment ?? undefined,
    adultsCount,
    childrenCount,
    status: BookingStatus.NEW,
  });

    triggerBookingCreatedSideEffects({
    bookingId: result.bookingId,
    userId: input.userId ?? null,
    entityType: "PLACE",
    entityId: place.id,
    entityTitle: place.title,
    cityId: place.cityId ?? null,
    ownerUserId: place.ownerBusiness?.ownerUserId ?? null,
    customerName,
    placeId: place.id,
    placeTitle: place.title,
    });

    await logBookingCreatedAudit({
      bookingId: result.bookingId,
      status: result.status,
      actorId: input.userId ?? null,
      actorRole: input.userId ? "USER" : "ANONYMOUS",
      publicationType: PublicationType.PLACE,
      entityType: "PLACE",
      entityId: place.id,
      businessId: place.ownerBusinessId,
      customerName,
      customerPhone,
      customerEmail,
      metadata: {
        source: "public_booking",
      },
    });

    return result;
  }

// ─── Camp shift booking ───────────────────────────────────────────────────────

/**
 * Создаёт заявку на конкретную смену лагеря.
 *
 * Проверяет:
 * 1. Offer существует и публично доступен
 * 2. Offer является лагерем (campProgramType задан)
 * 3. Смена с переданным id присутствует в Offer.campSessions
 * 4. Обязательные поля заполнены
 *
 * Не списывает места (capacity check — фаза 2).
 */
export async function createCampShiftBooking(
  input: CreateCampShiftBookingInput,
): Promise<CreateBookingResult> {
  const { customerName, customerPhone } = validateBookingCustomer(input);

  if (!input.campShift.id) {
    throw new BookingValidationError("campShiftId", "Не выбрана смена");
  }

  const offer = await prisma.offer.findFirst({
    where: {
      id: input.offerId,
      ...getPublicPublishedOfferWhere(),
    },
    select: {
      id: true,
      title: true,
      bookingEnabled: true,
      campProgramType: true,
      campSessions: true,
      placeId: true,
      place: {
        select: {
          cityId: true,
          ownerBusinessId: true,
          ownerBusiness: {
            select: {
              ownerUserId: true,
            },
          },
        },
      },
    },
  });

  if (!offer) {
    throw new BookingNotFoundError("Предложение недоступно для записи");
  }
  if (!offer.bookingEnabled) {
    throw new BookingValidationError("offerId", "Запись недоступна для этого предложения");
  }
  if (!offer.campProgramType) {
    throw new BookingValidationError("offerId", "Предложение не является лагерем");
  }

  const businessId = offer.place?.ownerBusinessId;
  if (!businessId) {
    throw new BookingValidationError("offerId", "Бизнес-аккаунт не найден для этого предложения");
  }

  const sessions = parseCampSessions(offer.campSessions);
  const shift = sessions.find((session) => session.id === input.campShift.id);
  if (!shift) {
    throw new BookingValidationError(
      "campShiftId",
      `Смена с id "${input.campShift.id}" не найдена в этом предложении`,
    );
  }

  const shiftDateFrom = shift.dateFrom ? new Date(shift.dateFrom) : null;
  const shiftDateTo = shift.dateTo ? new Date(shift.dateTo) : null;

  const result = await createBookingWithInitialActivity({
    businessId,
    userId: input.userId ?? undefined,
    publicationType: PublicationType.OFFER,
    offerId: input.offerId,
    campShiftId: input.campShift.id,
    campShiftTitle: shift.title ?? input.campShift.title ?? null,
    campShiftDateFrom: shiftDateFrom ?? undefined,
    campShiftDateTo: shiftDateTo ?? undefined,
    customerName,
    customerPhone,
    customerEmail: normalizeOptionalString(input.customerEmail) ?? undefined,
    customerComment: normalizeOptionalString(input.comment) ?? undefined,
    childName: normalizeOptionalString(input.childName) ?? undefined,
    childAge: input.childAge ?? undefined,
    status: BookingStatus.NEW,
  });

  triggerBookingCreatedSideEffects({
    bookingId: result.bookingId,
    userId: input.userId ?? null,
    entityType: "OFFER",
    entityId: input.offerId,
    entityTitle: offer.title ?? null,
    cityId: offer.place?.cityId ?? null,
    ownerUserId: offer.place?.ownerBusiness?.ownerUserId ?? null,
    customerName,
    childName: normalizeOptionalString(input.childName),
    childAge: input.childAge ?? null,
    offerId: input.offerId,
    offerTitle: offer.title ?? null,
    campShiftId: input.campShift.id,
    campShiftTitle: shift.title ?? input.campShift.title ?? null,
    campShiftDateFrom: shiftDateFrom,
    campShiftDateTo: shiftDateTo,
  });

  await logBookingCreatedAudit({
    bookingId: result.bookingId,
    status: result.status,
    actorId: input.userId ?? null,
    actorRole: input.userId ? "USER" : "ANONYMOUS",
    publicationType: PublicationType.OFFER,
    entityType: "OFFER",
    entityId: input.offerId,
    businessId,
    customerName,
    customerPhone,
    customerEmail: normalizeOptionalString(input.customerEmail),
    metadata: {
      source: "camp_shift_booking",
      campShiftId: input.campShift.id,
    },
  });

  return result;
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

function parseCampSessions(raw: unknown): Array<RawCampSession & { id: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item, idx) => ({
      ...item,
      id: typeof item.id === "string" && item.id ? item.id : String(idx),
    }));
}

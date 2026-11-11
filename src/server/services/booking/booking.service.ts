import { createHash } from "node:crypto";
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
import { addDaysLocal, getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { eventBookingSlotKey, getEventBookingSchedule } from "@/lib/event/eventBookingSchedule";
import { formatHHMM } from "@/lib/formatters/date";
import { reserveSlot } from "@/server/offers/reserveSlot";
import { childScopeFor } from "@/server/family/familyAccess";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";
import {
  BookingMode,
  BookingStatus,
  Prisma,
  PublicationType,
} from "@prisma/client";
import { notifyBookingCreated, notifyUserBookingSubmitted } from "@/server/services/notification.service";
import { resolveBookingPlanItem } from "@/server/family/planBooking.service";
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
  /** Family Core M6: plan item the booking is made for (must be visible to the user). */
  planItemId?: string | null;
}

export interface CreateBookingResult {
  bookingId: string;
  status: BookingStatus;
}

interface BookingSideEffectsContext {
  bookingId: string;
  planItemId?: string | null;
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
  transaction?: Prisma.TransactionClient,
  actorId?: string,
): Promise<CreateBookingResult> {
  const now = new Date();
  async function create(tx: Prisma.TransactionClient) {
    const booking = await tx.bookingRequest.create({
      data: { ...data, lastActivityAt: now },
      select: { id: true, status: true },
    });
    await tx.bookingActivity.create({
      data: {
        bookingId: booking.id,
        type: "CREATED",
        actorType: actorId ? "BUSINESS" : "SYSTEM",
        actorId,
        payload: Prisma.JsonNull,
        createdAt: now,
      },
    });
    return { bookingId: booking.id, status: booking.status };
  }
  return transaction ? create(transaction) : prisma.$transaction(create);
}

async function triggerBookingCreatedSideEffects(context: BookingSideEffectsContext): Promise<void> {
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
      // Family Core M6: lets the "make private" rule see another adult's booking.
      ...(context.planItemId ? { planItemId: context.planItemId } : {}),
    },
  }).catch((err) => console.error("[booking.service] analytics failed:", err));

  const promises: Promise<unknown>[] = [];
  if (context.ownerUserId) promises.push(notifyBookingCreated({
    ownerUserId: context.ownerUserId,
    bookingId: context.bookingId,
    waitForDelivery: context.entityType === "EVENT",
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
  }).catch((err) => {
    console.error("[booking.service] notifyBookingCreated failed:", { bookingId: context.bookingId, error: err });
  }));

  if (context.userId) promises.push(notifyUserBookingSubmitted({
    userId: context.userId,
    bookingId: context.bookingId,
    publicationTitle: context.entityTitle,
  }).catch((err) => {
    console.error("[booking.service] notifyUserBookingSubmitted failed:", { bookingId: context.bookingId, error: err });
  }));
  await Promise.all(promises);
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

/**
 * Reserve an actual class session through the transactional slot engine.
 * Keeps the same audit/notifications/family link as regular public bookings.
 */
export async function createPublicClassSlotBooking(input: {
  offerId: string;
  classGroupId?: string | null;
  classTariffId?: string | null;
  selectedOptionIds?: string[];
  idempotencyKey?: string;
  startsAt: Date;
  endsAt: Date;
  seats: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerComment?: string | null;
  userId?: string | null;
  planItemId?: string | null;
  childId?: string | null;
}): Promise<{ bookingId: string; holdUntil: Date; status: BookingStatus }> {
  const { customerName, customerPhone } = validateBookingCustomer(input);
  const offer = await prisma.offer.findFirst({
    where: {
      id: input.offerId,
      ...getPublicPublishedOfferWhere(),
      productType: { in: ["REGULAR_ACTIVITY", "ONE_TIME_ACTIVITY"] },
      bookingEnabled: true,
      bookingMode: { in: ["USE_PUBLICATION_DATES", "USE_PUBLICATION_SLOTS"] },
    },
    select: {
      id: true,
      title: true,
      place: { select: {
        cityId: true,
        ownerBusinessId: true,
        ownerBusiness: { select: { ownerUserId: true } },
      } },
    },
  });
  if (!offer?.place?.ownerBusinessId) {
    throw new BookingNotFoundError("Занятие недоступно для записи");
  }
  if (input.childId && (!input.userId || input.seats !== 1)) {
    throw new BookingValidationError("childId", "Выберите одного ребёнка для одного места");
  }
  const child = input.childId
    ? await prisma.child.findFirst({
        where: { id: input.childId, ...(await childScopeFor(input.userId!)) },
        select: { name: true, birthDate: true },
      })
    : null;
  if (input.childId && !child) {
    throw new BookingValidationError("childId", "Ребёнок недоступен");
  }
  const classDate = input.startsAt;
  const childAge = child?.birthDate ? (() => {
    let age = classDate.getUTCFullYear() - child.birthDate.getUTCFullYear();
    const month = classDate.getUTCMonth() - child.birthDate.getUTCMonth();
    if (month < 0 || (month === 0 && classDate.getUTCDate() < child.birthDate.getUTCDate())) age--;
    return age >= 0 && age <= 18 ? age : null;
  })() : null;
  const planLink = await resolveBookingPlanItem({
    userId: input.userId,
    planItemId: input.planItemId,
    publicationType: "OFFER",
    publicationId: offer.id,
    requestedDate: input.startsAt,
  });
  if (planLink.invalid) {
    throw new BookingValidationError("planItemId", "Запись плана недоступна");
  }

  const result = await reserveSlot({
    offerId: offer.id,
    classGroupId: input.classGroupId,
    classTariffId: input.classTariffId,
    selectedOptionIds: input.selectedOptionIds,
    idempotencyKey: input.idempotencyKey,
    childId: input.childId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    seats: input.seats,
    customerName,
    customerPhone,
    customerEmail: input.customerEmail,
    customerComment: input.customerComment,
    userId: input.userId,
    planItemId: planLink.planItemId,
    holdMinutes: 120,
    childName: child?.name?.trim() || null,
    childAge,
  });

  if (!result.replayed) {
    triggerBookingCreatedSideEffects({
    planItemId: planLink.planItemId,
    bookingId: result.bookingId,
    userId: input.userId ?? null,
    entityType: "OFFER",
    entityId: offer.id,
    entityTitle: offer.title,
    cityId: offer.place.cityId ?? null,
    ownerUserId: offer.place.ownerBusiness?.ownerUserId ?? null,
    customerName,
    childName: child?.name?.trim() || null,
    childAge,
    offerId: offer.id,
    offerTitle: offer.title,
  });
  await logBookingCreatedAudit({
    bookingId: result.bookingId,
    status: BookingStatus.NEW,
    actorId: input.userId ?? null,
    actorRole: input.userId ? "USER" : "ANONYMOUS",
    publicationType: PublicationType.OFFER,
    entityType: "OFFER",
    entityId: offer.id,
    businessId: offer.place.ownerBusinessId,
    customerName,
    customerPhone,
    customerEmail: normalizeOptionalString(input.customerEmail),
    metadata: { source: "public_class_slot", startsAt: input.startsAt.toISOString(), seats: input.seats },
  });
  }
  return { bookingId: result.bookingId, holdUntil: result.holdUntil, status: result.status };
}

// ─── Generic public booking ──────────────────────────────────────────────────

/**
 * Создаёт публичную заявку для EVENT / OFFER / PLACE.
 * Все публичные write-paths должны идти через этот command-layer.
 */
export function createPublicBooking(input: CreatePublicBookingInput): Promise<CreateBookingResult> {
  return createPublicationBooking(input);
}

export const manualRequestOfferWhere = {
  bookingMode: "REQUEST_ONLY", offerBooking: null, classGroups: { none: {} }, campProgramType: null,
} satisfies Prisma.OfferWhereInput;

export const manualScheduledOfferWhere = {
  bookingEnabled: true,
  bookingMode: { in: ["USE_PUBLICATION_DATES", "USE_PUBLICATION_SLOTS"] },
  productType: { in: ["REGULAR_ACTIVITY", "ONE_TIME_ACTIVITY"] },
  offerBooking: { isNot: null },
} satisfies Prisma.OfferWhereInput;

type ManualBookingInput = Omit<CreatePublicBookingInput, "userId" | "planItemId"> & {
  status: "NEW" | "CONFIRMED";
  offerSlot?: { startsAt: string; endsAt: string; groupId?: string; tariffId?: string; unitId?: string };
};

export async function createManualBooking(
  input: ManualBookingInput,
  context: { businessId: string; actorId: string; requestKey: string },
): Promise<CreateBookingResult> {
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${context.businessId + ":" + context.requestKey}, 0))`;
    const previous = await tx.bookingRequest.findUnique({
      where: { businessId_manualRequestKey: { businessId: context.businessId, manualRequestKey: context.requestKey } },
      select: { id: true, status: true, manualRequestHash: true },
    });
    if (previous) {
      if (previous.manualRequestHash !== hash) throw new BookingValidationError("requestKey", "Ключ уже использован для другой записи");
      return { bookingId: previous.id, status: previous.status };
    }
    if (input.offerSlot && input.publicationType === PublicationType.OFFER) {
      const offer = await tx.offer.findFirst({
        where: { ...getPublicPublishedOfferWhere(), ...manualScheduledOfferWhere, id: input.publicationId, place: { ownerBusinessId: context.businessId } },
        select: { id: true },
      });
      if (!offer) throw new BookingNotFoundError("Предложение недоступно для записи");
      const { customerName, customerPhone } = validateBookingCustomer(input);
      const adultsCount = input.adultsCount ?? 1;
      const childrenCount = input.childrenCount ?? 0;
      const slot = input.offerSlot;
      const result = await reserveSlot({
        offerId: offer.id, startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt),
        classGroupId: slot.groupId, classTariffId: slot.tariffId, unitId: slot.unitId,
        seats: adultsCount + childrenCount, customerName, customerPhone,
        customerEmail: input.customerEmail, customerComment: input.customerComment,
      }, { ...context, tx, hash, status: input.status, adultsCount, childrenCount });
      return { bookingId: result.bookingId, status: result.status };
    }
    return createPublicationBooking(input, { ...context, hash, status: input.status, tx });
  }, { timeout: 30_000 });
}

async function createPublicationBooking(
  input: CreatePublicBookingInput,
  manual?: { businessId: string; actorId: string; requestKey: string; hash: string; status: "NEW" | "CONFIRMED"; tx: Prisma.TransactionClient },
): Promise<CreateBookingResult> {
  const db = manual?.tx ?? prisma;
  const source = manual ? { source: "MANUAL" as const, manualRequestKey: manual.requestKey, manualRequestHash: manual.hash } : {};
  const status = manual?.status ?? BookingStatus.NEW;
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

  const planLink = manual ? { planItemId: null, invalid: false } : await resolveBookingPlanItem({
    userId: input.userId,
    planItemId: input.planItemId,
    publicationType: input.publicationType,
    publicationId: input.publicationId,
    requestedDate: requestedDate ?? null,
  });
  if (planLink.invalid) {
    throw new BookingValidationError("planItemId", "Запись плана недоступна");
  }

  if (input.selectedSessionId && input.publicationType !== PublicationType.EVENT) {
    throw new BookingValidationError(
      "selectedSessionId",
      "Слоты доступны только для событий",
    );
  }

  if (input.publicationType === PublicationType.EVENT) {
    async function createEvent(tx: Prisma.TransactionClient) {
      // Serialize capacity and duplicate checks for the same event. Read the
      // booking configuration after obtaining the lock used by event edits.
      await tx.$queryRaw`SELECT "id" FROM "Activity" WHERE "id" = ${input.publicationId}
        ${manual ? Prisma.sql`AND "businessId" = ${manual.businessId}` : Prisma.empty} FOR UPDATE`;
      const activity = await tx.activity.findFirst({
        where: { ...getPublicActivityDetailWhere(), id: input.publicationId, type: "EVENT", ...(manual ? { businessId: manual.businessId } : {}) },
        select: {
          id: true,
          title: true,
          cityId: true,
          placeId: true,
          bookingEnabled: true,
          bookingMode: true,
          bookingCapacityPerSlot: true,
          scheduleJson: true,
          businessId: true,
          business: { select: { ownerUserId: true } },
        },
      });

      if (!activity) throw new BookingNotFoundError("Событие недоступно для записи");
      if (!activity.bookingEnabled || !activity.businessId) {
        throw new BookingValidationError("publicationId", "Запись недоступна для этого события");
      }
      if (activity.bookingMode === BookingMode.USE_PUBLICATION_SLOTS && !input.selectedSessionId) {
        throw new BookingValidationError("selectedSessionId", "Нужно выбрать слот");
      }
      if (activity.bookingMode === BookingMode.USE_PUBLICATION_DATES && !requestedDate) {
        throw new BookingValidationError("requestedDate", "Нужно выбрать дату");
      }

      if (manual && activity.bookingMode === BookingMode.REQUEST_ONLY && (requestedDate || requestedTime || input.selectedSessionId)) {
        throw new BookingValidationError("requestedDate", "Для заявки дата и время не указываются");
      }
      let date = requestedDate;
      let time = requestedTime;
      let capacity: number | undefined;
      let slotStart: Date | undefined;
      const schedule = activity.scheduleJson as Record<string, unknown> | null;
      const wizardCalendar = schedule?.participationMode === "time-slots" ||
        schedule?.participationMode === "simple-booking";
      if (wizardCalendar && activity.bookingMode === BookingMode.USE_PUBLICATION_DATES) {
        const dateKey = date?.toISOString().slice(0, 10) ?? "";
        const day = getEventBookingSchedule(schedule).get(eventBookingSlotKey(dateKey, ""));
        if (!day || dateKey < getLocalDateKey() || input.selectedSessionId || time) {
          throw new BookingValidationError("requestedDate", "Дата недоступна для записи");
        }
        date = new Date(dateKey);
        capacity = day.capacity;
      } else if (manual && activity.bookingMode === BookingMode.USE_PUBLICATION_DATES) {
        const dateKey = date?.toISOString().slice(0, 10) ?? "";
        if (!dateKey || dateKey < getLocalDateKey() || input.selectedSessionId || time) {
          throw new BookingValidationError("requestedDate", "Дата недоступна для записи");
        }
        const session = await tx.activitySession.findFirst({
          where: {
            activityId: activity.id, withdrawnAt: null, OR: [{ isSaleOpen: null }, { isSaleOpen: true }],
            startsAt: { gte: localWallClockToUtc(dateKey, "00:00"), lt: localWallClockToUtc(addDaysLocal(dateKey, 1), "00:00"), gt: new Date() },
          },
          select: { id: true },
        });
        if (!session) throw new BookingValidationError("requestedDate", "Дата недоступна для записи");
      } else if (input.selectedSessionId) {
        const session = await tx.activitySession.findFirst({
          where: {
            id: input.selectedSessionId,
            activityId: activity.id,
            withdrawnAt: null,
            startsAt: { gt: new Date() },
            OR: [{ isSaleOpen: null }, { isSaleOpen: true }],
          },
          select: { startsAt: true },
        });
        if (!session) throw new BookingValidationError("selectedSessionId", "Слот недоступен");
        const localDate = getLocalDateKey(session.startsAt);
        const localTime = formatHHMM(session.startsAt);
        const slot = getEventBookingSchedule(schedule).get(eventBookingSlotKey(localDate, localTime));
        if (wizardCalendar && !slot) {
          throw new BookingValidationError("selectedSessionId", "Слот недоступен для записи");
        }
        if ((date && date.toISOString().slice(0, 10) !== localDate) || (time && time !== localTime)) {
          throw new BookingValidationError("selectedSessionId", "Дата или время не соответствуют слоту");
        }
        date = new Date(localDate);
        time = localTime;
        slotStart = localWallClockToUtc(localDate, localTime);
        capacity = slot?.capacity ?? activity.bookingCapacityPerSlot ?? undefined;
      }

      const active: Prisma.BookingRequestWhereInput = {
        activityId: activity.id,
        publicationType: PublicationType.EVENT,
        status: { in: [BookingStatus.NEW, BookingStatus.CONFIRMED] },
        ...(slotStart ? {
          OR: [
            { session: { startsAt: { gte: slotStart, lt: new Date(slotStart.getTime() + 60_000) } } },
            { requestedDate: date, requestedTime: time },
          ],
        } : { selectedSessionId: null, requestedDate: date, requestedTime: time }),
      };
      const duplicate = await tx.bookingRequest.findFirst({
        where: { ...active, customerPhone },
        select: { id: true },
      });
      if (duplicate) {
        throw new BookingValidationError("customerPhone", "Заявка на эту запись уже существует");
      }
      if (capacity !== undefined) {
        const { _sum } = await tx.bookingRequest.aggregate({
          where: active,
          _sum: { adultsCount: true, childrenCount: true },
        });
        if ((_sum.adultsCount ?? 0) + (_sum.childrenCount ?? 0) + adultsCount + childrenCount > capacity) {
          throw new BookingValidationError("selectedSessionId", "На выбранное время недостаточно мест");
        }
      }

      const result = await createBookingWithInitialActivity({
        planItemId: planLink.planItemId ?? undefined,
        businessId: activity.businessId,
        userId: input.userId ?? undefined,
        publicationType: PublicationType.EVENT,
        activityId: activity.id,
        placeId: activity.placeId ?? undefined,
        selectedSessionId: input.selectedSessionId ?? undefined,
        requestedDate: date ?? undefined,
        requestedTime: time ?? undefined,
        customerName,
        customerPhone,
        customerEmail: customerEmail ?? undefined,
        customerComment: customerComment ?? undefined,
        adultsCount,
        childrenCount,
        status,
        ...source,
      }, tx, manual?.actorId);
      return { activity: { ...activity, businessId: activity.businessId }, result };
    }
    const { activity, result } = manual ? await createEvent(manual.tx) : await prisma.$transaction(createEvent);
    if (manual) return result;

    await triggerBookingCreatedSideEffects({
      planItemId: planLink.planItemId,
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
    const offer = await db.offer.findFirst({
      where: {
        id: input.publicationId,
        ...getPublicPublishedOfferWhere(),
        ...(manual ? {
          place: { ownerBusinessId: manual.businessId },
          ...manualRequestOfferWhere,
        } : {}),
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
      planItemId: planLink.planItemId ?? undefined,
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
      status,
      ...source,
    }, manual?.tx, manual?.actorId);
    if (manual) return result;

    triggerBookingCreatedSideEffects({
      planItemId: planLink.planItemId,
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

  const place = await db.place.findFirst({
    where: {
      id: input.publicationId,
      ...getPublicPublishedPlaceWhere(),
      ...(manual ? { ownerBusinessId: manual.businessId } : {}),
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
    planItemId: planLink.planItemId ?? undefined,
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
    status,
    ...source,
  }, manual?.tx, manual?.actorId);
  if (manual) return result;

  triggerBookingCreatedSideEffects({
    planItemId: planLink.planItemId,
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

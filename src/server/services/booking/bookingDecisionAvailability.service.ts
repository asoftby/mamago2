import { loadSlotSnapshot } from "@/server/offers/getSlots";
import { calculateSlots } from "@/server/offers/slotAvailability";
import { BookingKind, BookingMode, BookingStatus, Prisma, PublicationType } from "@prisma/client";
import { getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";
import { eventBookingSlotKey, getEventBookingSchedule } from "@/lib/event/eventBookingSchedule";
import { getEventSeatPolicy, calculateEventSeatAvailability, occupiedEventSeats, type EventSeatPolicy } from "@/lib/booking/eventSeatPolicy";

type Db = Prisma.TransactionClient;

export type BookingDecisionAvailability = {
  requested?: number;
  occupied?: number;
  canConfirm: boolean;
  code: "AVAILABLE" | "FULL" | "UNLIMITED" | "NOT_APPLICABLE" | "UNAVAILABLE";
  message: string;
  remaining: number | null;
  capacity: number | null;
  adultsRemaining?: number | null;
  childrenRemaining?: number | null;
};

/** A pending request already occupies its seats; confirmation does not add seats. */
export function assessCurrentEventBookingCapacity(input: {
  policy: EventSeatPolicy;
  capacity: number | null | undefined;
  usedAdults: number;
  usedChildren: number;
  requestAdults: number;
  requestChildren: number;
}): BookingDecisionAvailability {
  const { policy, capacity, usedAdults, usedChildren, requestAdults, requestChildren } = input;
  if (policy.mode === "CHILDREN" && requestChildren < 1) {
    return { canConfirm: false, code: "UNAVAILABLE", message: "В заявке нет ребёнка для детского сеанса", remaining: null, capacity: capacity ?? null };
  }
  if (policy.mode === "ADULTS" && requestAdults < 1) {
    return { canConfirm: false, code: "UNAVAILABLE", message: "В заявке нет взрослого для этого сеанса", remaining: null, capacity: capacity ?? null };
  }
  const state = calculateEventSeatAvailability({ policy, capacity, usedAdults, usedChildren });
  if (!state) {
    return { canConfirm: true, code: "UNLIMITED", message: "Лимит не задан: подтверждение возможно, но свободные места не рассчитываются", remaining: null, capacity: null };
  }
  const exceedsCapacity = policy.mode === "SEPARATE"
    ? usedAdults > (state.adultsCapacity ?? 0) || usedChildren > (state.childrenCapacity ?? 0)
    : occupiedEventSeats(policy.mode, usedAdults, usedChildren) > state.capacity;
  const missingHold = policy.mode === "SEPARATE"
    ? requestAdults > usedAdults || requestChildren > usedChildren
    : occupiedEventSeats(policy.mode, requestAdults, requestChildren) > occupiedEventSeats(policy.mode, usedAdults, usedChildren);
  if (exceedsCapacity || missingHold) {
    return {
      canConfirm: false, code: "FULL", message: "Мест недостаточно: состав текущих записей превышает лимит. Заявку нельзя подтвердить.",
      remaining: state.remaining, capacity: state.capacity,
      adultsRemaining: state.adultsRemaining ?? null, childrenRemaining: state.childrenRemaining ?? null,
    };
  }
  return {
    canConfirm: true, code: "AVAILABLE",
    message: state.remaining === 0
      ? "Места этой заявки уже учтены: можно подтвердить, хотя свободных мест больше нет"
      : "Место за этой заявкой учтено: подтверждение доступно",
    remaining: state.remaining, capacity: state.capacity,
    adultsRemaining: state.adultsRemaining ?? null, childrenRemaining: state.childrenRemaining ?? null,
  };
}

const unavailable = (message: string): BookingDecisionAvailability => ({
  canConfirm: false, code: "UNAVAILABLE", message, remaining: null, capacity: null,
});

/**
 * Tenant-scoped single-event decision. Reuse this helper for the business
 * GET preview and for definitive confirmation while holding the Activity lock.
 */
export async function getBusinessBookingDecisionAvailability(
  db: Db, bookingId: string, businessId: string, now: Date = new Date(),
): Promise<BookingDecisionAvailability | null> {
  const request = await db.bookingRequest.findFirst({
    where: { id: bookingId, businessId, kind: BookingKind.STANDARD },
    select: {
      offerId: true, offerSessionId: true, startsAt: true, endsAt: true, seats: true, classGroupId: true,
      allocations: { select: { bookingUnitId: true, status: true, expiresAt: true } },
      status: true, activityId: true, publicationType: true, holdUntil: true,
      adultsCount: true, childrenCount: true,
      selectedSessionId: true, requestedDate: true, requestedTime: true,
      session: { select: { startsAt: true, withdrawnAt: true, isSaleOpen: true } },
    },
  });
  if (!request) return null;
  if (request.status !== BookingStatus.NEW) return unavailable("Заявка уже обработана");
  if (request.holdUntil && request.holdUntil.getTime() <= now.getTime()) {
    return unavailable("Срок резервирования истёк. Подтвердить эту заявку нельзя");
  }
  if (request.offerId && request.startsAt && request.endsAt) {
    const query = { offerId: request.offerId, classGroupId: request.classGroupId ?? undefined,
      from: request.startsAt, to: new Date(request.endsAt.getTime() + 1), requestedSeats: request.seats };
    const snapshot = await loadSlotSnapshot(query, db, bookingId);
    if (!snapshot) return unavailable("Расписание больше недоступно");
    if (snapshot.units.length > 0 && request.allocations.length === 0) {
      return unavailable("У заявки отсутствует резерв обязательного ресурса");
    }
    if (request.allocations.some((a) => !["HELD", "CONFIRMED"].includes(a.status) ||
      (a.status === "HELD" && a.expiresAt !== null && a.expiresAt <= now))) {
      return unavailable("Резерв ресурса истёк или освобождён");
    }
    // Lead time controls new reservations. This request already holds its slot.
    const slot = calculateSlots({ ...snapshot, leadTimeHours: 0 }, {
      ...query, ...(snapshot.scheduleKind === "ON_REQUEST_WINDOWS" ? {
        requestedDurationMinutes: (request.endsAt.getTime() - request.startsAt.getTime()) / 60_000,
      } : {}),
    }, now).find((slot) =>
      slot.startsAt.getTime() === request.startsAt!.getTime() &&
      slot.endsAt.getTime() === request.endsAt!.getTime());
    if (!slot || request.allocations.some((a) => !slot.unitIds.includes(a.bookingUnitId))) {
      return unavailable("Недостаточно мест или выбранный ресурс недоступен");
    }
    return { canConfirm: true, code: "AVAILABLE", message: "Достаточно мест и ресурсов для подтверждения",
      remaining: slot.remainingSeats, capacity: snapshot.sessions.find((s) => s.id === slot.sessionId)?.capacity ?? snapshot.capacity };
  }
  if (request.publicationType !== PublicationType.EVENT || !request.activityId) {
    return { canConfirm: true, code: "NOT_APPLICABLE", message: "Для этой заявки учёт мест по сеансам не применяется", remaining: null, capacity: null };
  }
  const activity = await db.activity.findFirst({
    where: { id: request.activityId, businessId, type: "EVENT" },
    select: { bookingEnabled: true, bookingMode: true, scheduleJson: true, bookingCapacityPerSlot: true },
  });
  if (!activity) return unavailable("Событие не найдено");
  if (!activity.bookingEnabled) return unavailable("Запись на событие отключена");
  if (activity.bookingMode === BookingMode.REQUEST_ONLY) {
    return { canConfirm: true, code: "NOT_APPLICABLE", message: "Это заявка без сеанса: отдельный лимит мест не настроен", remaining: null, capacity: null };
  }
  if (request.selectedSessionId &&
      (!request.session || request.session.withdrawnAt || request.session.isSaleOpen === false)) {
    return unavailable("Сеанс закрыт или отозван");
  }
  const calendar = getEventBookingSchedule(activity.scheduleJson, activity.bookingMode);
  const date = request.session ? getLocalDateKey(request.session.startsAt)
    : request.requestedDate?.toISOString().slice(0, 10);
  if (!date) return unavailable("Дата заявки недоступна");
  const mode = activity.bookingMode;
  let capacity: number | null | undefined;
  let where: Prisma.BookingRequestWhereInput;
  if (mode === BookingMode.USE_PUBLICATION_DATES) {
    const slot = calendar.get(eventBookingSlotKey(date, ""));
    if (!slot || date < getLocalDateKey(now)) return unavailable("Дата больше не доступна для записи");
    capacity = slot.capacity ?? activity.bookingCapacityPerSlot;
    where = { selectedSessionId: null, requestedDate: new Date(date), requestedTime: null };
  } else if (mode === BookingMode.USE_PUBLICATION_SLOTS) {
    const time = request.session ? formatHHMM(request.session.startsAt) : request.requestedTime;
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return unavailable("Время заявки недоступно");
    const start = localWallClockToUtc(date, time);
    if (start.getTime() <= now.getTime()) return unavailable("Время записи уже прошло");
    const slot = calendar.get(eventBookingSlotKey(date, time));
    if (!slot) return unavailable("Сеанс больше не доступен");
    capacity = slot.capacity ?? activity.bookingCapacityPerSlot;
    where = { OR: [
      { session: { startsAt: { gte: start, lt: new Date(start.getTime() + 60_000) } } },
      { requestedDate: new Date(date), requestedTime: time },
    ] };
  } else {
    return unavailable("Неизвестный режим записи");
  }
  const active = {
    activityId: request.activityId, publicationType: PublicationType.EVENT,
    status: { in: [BookingStatus.NEW, BookingStatus.CONFIRMED] },
    ...where,
  } satisfies Prisma.BookingRequestWhereInput;
  // Include the request itself (NEW): its hold already occupies a place.
  const { _sum } = await db.bookingRequest.aggregate({
    where: active, _sum: { adultsCount: true, childrenCount: true },
  });
  const assessment = assessCurrentEventBookingCapacity({
    policy: getEventSeatPolicy(activity.scheduleJson), capacity,
    usedAdults: _sum.adultsCount ?? 0, usedChildren: _sum.childrenCount ?? 0,
    requestAdults: request.adultsCount, requestChildren: request.childrenCount,
  });
  const policy = getEventSeatPolicy(activity.scheduleJson);
  const requested = occupiedEventSeats(policy.mode, request.adultsCount, request.childrenCount);
  const occupied = occupiedEventSeats(policy.mode, _sum.adultsCount ?? 0, _sum.childrenCount ?? 0);
  return { ...assessment, requested, occupied };
}

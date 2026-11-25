import { loadSlotSnapshot } from "@/server/offers/getSlots";
import { calculateSlots } from "@/server/offers/slotAvailability";
import { BookingKind, BookingMode, BookingStatus, Prisma, PublicationType } from "@prisma/client";
import { getLocalDateKey, localWallClockToUtc } from "@/lib/date/localDateKey";
import { formatHHMM } from "@/lib/formatters/date";
import { eventBookingSlotKey, getEventBookingSchedule } from "@/lib/event/eventBookingSchedule";
import { getEventSeatPolicy, calculateEventSeatAvailability, occupiedEventSeats, type EventSeatPolicy } from "@/lib/booking/eventSeatPolicy";

type Db = Prisma.TransactionClient;

export type BookingDecisionAvailability = {
  resourceLimits?: Array<{ id: string; name: string; capacity?: number | null; requested: number; available: boolean }>;
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
  if (request.publicationType === PublicationType.EVENT && !request.activityId) {
    return unavailable("Событие заявки больше недоступно");
  }
  if (request.offerId && request.offerSessionId && (!request.startsAt || !request.endsAt)) {
    const session = await db.offerSession.findFirst({
      where: { id: request.offerSessionId, offerId: request.offerId },
      select: { startAt: true, endAt: true },
    });
    if (!session) return unavailable("Сеанс заявки больше недоступен");
    request.startsAt ??= session.startAt;
    request.endsAt ??= session.endAt;
  }
  if (request.offerId && (!request.startsAt || !request.endsAt)) {
    const offer = await db.offer.findUnique({
      where: { id: request.offerId }, select: { bookingEnabled: true, bookingMode: true },
    });
    if (offer?.bookingEnabled && (offer.bookingMode === "USE_PUBLICATION_DATES" || offer.bookingMode === "USE_PUBLICATION_SLOTS")) {
      return unavailable("Для старой заявки не определён сеанс. Нужна новая запись на актуальное время");
    }
  }
  if (request.offerId && request.startsAt && request.endsAt) {
    const query = { offerId: request.offerId, classGroupId: request.classGroupId ?? undefined,
      from: request.startsAt, to: new Date(request.endsAt.getTime() + 1), requestedSeats: request.seats };
    const snapshot = await loadSlotSnapshot(query, db, bookingId);
    if (!snapshot) return unavailable("Расписание больше недоступно");
    if (snapshot.hasClassGroups && !request.classGroupId) {
      return unavailable("Для старой заявки не определена группа. Нужна новая запись на актуальное время");
    }
    if (snapshot.scheduleKind === "ON_REQUEST_WINDOWS" && request.allocations.length === 0) {
      return unavailable("У заявки отсутствует резерв обязательного ресурса");
    }
    // Lead time controls new reservations. This request already holds its slot.
    const slot = calculateSlots({ ...snapshot, leadTimeHours: 0 }, {
      ...query, ...(snapshot.scheduleKind === "ON_REQUEST_WINDOWS" ? {
        requestedDurationMinutes: (request.endsAt.getTime() - request.startsAt.getTime()) / 60_000,
      } : {}),
    }, now, { includeUnavailable: true }).find((slot) =>
      slot.startsAt.getTime() === request.startsAt!.getTime() &&
      slot.endsAt.getTime() === request.endsAt!.getTime());
    if (snapshot.scheduleKind !== "ON_REQUEST_WINDOWS" &&
        (!slot?.sessionId || (request.offerSessionId && slot.sessionId !== request.offerSessionId))) {
      return unavailable("Сеанс старой заявки не найден или изменился. Нужна новая запись на актуальное время");
    }
    const units = new Map(snapshot.units.map((unit) => [unit.id, unit]));
    const resourceLimits = request.allocations.map((allocation) => {
      const unit = units.get(allocation.bookingUnitId);
      return {
        id: allocation.bookingUnitId, name: unit?.name ?? "Ресурс",
        capacity: unit?.capacity, requested: request.seats,
        available: Boolean(unit && (unit.capacity == null || unit.capacity >= request.seats) && slot?.unitIds.includes(unit.id)),
      };
    });
    if (request.allocations.some((allocation) => !["HELD", "CONFIRMED"].includes(allocation.status) ||
      (allocation.status === "HELD" && allocation.expiresAt !== null && allocation.expiresAt <= now))) {
      return { ...unavailable("Резерв ресурса истёк или освобождён"), requested: request.seats,
        resourceLimits: resourceLimits.map((resource) => ({ ...resource, available: false })) };
    }
    if (!slot || resourceLimits.some((resource) => !resource.available)) {
      return { ...unavailable("Недостаточно мест или выбранный ресурс недоступен"), requested: request.seats, resourceLimits };
    }
    const heldSeats = request.holdUntil ? request.seats : 0;
    const canConfirm = slot.remainingSeats === null || slot.remainingSeats >= request.seats;
    return {
      canConfirm, code: canConfirm ? "AVAILABLE" : "FULL",
      message: canConfirm ? "Достаточно мест и ресурсов для подтверждения" :
        "Недостаточно свободных мест. Запрошено " + request.seats + ", доступно " + Math.max(0, slot.remainingSeats ?? 0),
      requested: request.seats,
      occupied: slot.occupiedSeats === undefined ? undefined : slot.occupiedSeats + heldSeats,
      remaining: slot.remainingSeats === null ? null : Math.max(0, slot.remainingSeats - heldSeats),
      capacity: slot.capacity ?? null,
      resourceLimits,
    };
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
    AND: [where, { OR: [
      { status: BookingStatus.CONFIRMED },
      { status: BookingStatus.NEW, OR: [{ holdUntil: null }, { holdUntil: { gt: now } }] },
    ] }],
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

import prisma from "@/lib/prisma";
import { BookingStatus, Prisma, PublicationType, ScheduleKind } from "@prisma/client";
import { loadSlotSnapshot } from "./getSlots";
import { calculateSlots, type SlotSnapshot } from "./slotAvailability";
import { dateKeyInZone, isoWeekday, localMinuteKey } from "./slotTime";

const MINUTE_MS = 60_000;
const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

export type ReserveSlotInput = {
  offerId: string;
  startsAt: Date;
  endsAt: Date;
  seats?: number;
  unitId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerComment?: string | null;
  userId?: string | null;
  planItemId?: string | null;
  holdMinutes?: number;
  childName?: string | null;
  childAge?: number | null;
};

export class SlotReservationError extends Error {
  constructor(
    public readonly code: "INVALID_SLOT" | "SLOT_UNAVAILABLE" | "OFFER_UNAVAILABLE" | "UNIT_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "SlotReservationError";
  }
}

function availableSlot(snapshot: SlotSnapshot, input: ReserveSlotInput, now: Date) {
  const slots = calculateSlots(snapshot, {
    from: input.startsAt,
    to: new Date(input.startsAt.getTime() + 1),
    requestedSeats: input.seats ?? 1,
  }, now);
  return slots.find((slot) =>
    slot.startsAt.getTime() === input.startsAt.getTime() &&
    slot.endsAt.getTime() === input.endsAt.getTime());
}

function sessionCapacity(snapshot: SlotSnapshot, start: Date): number | null {
  const existing = snapshot.sessions.find((session) => session.startAt.getTime() === start.getTime());
  if (existing) return existing.capacity ?? snapshot.capacity;
  const local = localMinuteKey(start, snapshot.timezone);
  const date = dateKeyInZone(start, snapshot.timezone);
  const minute = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  const rule = snapshot.rules.find((item) =>
    item.weekday === isoWeekday(date) && item.startMinutes === minute &&
    (!item.validFrom || item.validFrom <= date) && (!item.validTo || item.validTo >= date));
  return rule?.capacity ?? snapshot.capacity;
}

function isExclusionViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string; meta?: { code?: string; database_error?: string } };
  return value.code === "23P01" ||
    (value.code === "P2010" && value.meta?.code === "23P01") ||
    Boolean(value.message?.includes("BookingAllocation_no_active_overlap") ||
      value.meta?.database_error?.includes("BookingAllocation_no_active_overlap"));
}

/**
 * Reserve a slot using the existing BookingRequest and BookingAllocation tables.
 * The preview is recalculated under the transaction; only this path commits a hold.
 */
export async function reserveSlot(input: ReserveSlotInput): Promise<{ bookingId: string; holdUntil: Date }> {
  const seats = input.seats ?? 1;
  const holdMinutes = input.holdMinutes ?? 24 * 60;
  if (!Number.isInteger(seats) || seats < 1 || seats > 100 ||
      !Number.isInteger(holdMinutes) || holdMinutes < 1 || holdMinutes > 24 * 60 ||
      !(input.startsAt instanceof Date) || !(input.endsAt instanceof Date) ||
      !Number.isFinite(input.startsAt.getTime()) || !Number.isFinite(input.endsAt.getTime()) ||
      input.endsAt <= input.startsAt || !input.customerName?.trim() ||
      !PHONE_RE.test(input.customerPhone?.trim() ?? "")) {
    throw new SlotReservationError("INVALID_SLOT", "Некорректные данные для бронирования");
  }
  const now = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({
        where: { id: input.offerId },
        select: { status: true, place: { select: { ownerBusinessId: true } }, offerBooking: { select: { leadTimeHours: true } } },
      });
      const businessId = offer?.place?.ownerBusinessId;
      if (!offer || offer.status !== "PUBLISHED" || !businessId || !offer.offerBooking) {
        throw new SlotReservationError("OFFER_UNAVAILABLE", "Предложение сейчас недоступно для записи");
      }
      const query = { offerId: input.offerId, from: input.startsAt, to: new Date(input.endsAt.getTime() + 1), requestedSeats: seats };
      const initial = await loadSlotSnapshot(query, tx);
      if (!initial) throw new SlotReservationError("OFFER_UNAVAILABLE", "Запись по расписанию не включена");
      const candidate = availableSlot(initial, input, now);
      if (!candidate) throw new SlotReservationError("SLOT_UNAVAILABLE", "Слот уже недоступен");

      const holdUntil = new Date(Math.min(
        now.getTime() + holdMinutes * MINUTE_MS,
        input.startsAt.getTime() - offer.offerBooking.leadTimeHours * 60 * MINUTE_MS,
      ));
      if (holdUntil <= now) throw new SlotReservationError("SLOT_UNAVAILABLE", "Время записи на этот слот истекло");

      let sessionId: string | null = null;
      let unitId: string | null = null;
      let blockStart: Date | null = null;
      let blockEnd: Date | null = null;
      if (initial.scheduleKind === ScheduleKind.ON_REQUEST_WINDOWS) {
        unitId = input.unitId ?? (candidate.unitIds.length === 1 ? candidate.unitIds[0] : null);
        if (!unitId) throw new SlotReservationError("UNIT_REQUIRED", "Выберите конкретный ресурс для бронирования");
        if (!candidate.unitIds.includes(unitId)) throw new SlotReservationError("SLOT_UNAVAILABLE", "Ресурс уже занят");
        // The exclusion constraint cannot depend on now(). Release expired holds
        // inside this transaction before the availability recheck and insert.
        await tx.$executeRaw`UPDATE "BookingAllocation" SET "status" = 'EXPIRED', "updatedAt" = now()
          WHERE "bookingUnitId" = ${unitId} AND "status" = 'HELD' AND "expiresAt" < now()`;
        const unit = initial.units.find((item) => item.id === unitId)!;
        blockStart = new Date(input.startsAt.getTime() - unit.prepMinutes * MINUTE_MS);
        blockEnd = new Date(input.endsAt.getTime() + (unit.cleanupMinutes + initial.bufferMin) * MINUTE_MS);
      } else {
        const capacity = sessionCapacity(initial, input.startsAt);
        if (capacity == null || capacity < seats) throw new SlotReservationError("SLOT_UNAVAILABLE", "Нет свободных мест");
        const session = await tx.offerSession.upsert({
          where: { offerId_startAt: { offerId: input.offerId, startAt: input.startsAt } },
          create: { offerId: input.offerId, startAt: input.startsAt, endAt: input.endsAt, capacity },
          update: {},
          select: { id: true },
        });
        // A row lock serializes concurrent group reservations, including first
        // materialization through the unique (offerId, startAt) upsert above.
        await tx.$queryRaw`SELECT "id" FROM "OfferSession" WHERE "id" = ${session.id} FOR UPDATE`;
        sessionId = session.id;
      }

      const current = await loadSlotSnapshot(query, tx);
      const checked = current && availableSlot(current, input, now);
      if (!checked || (unitId && !checked.unitIds.includes(unitId))) {
        throw new SlotReservationError("SLOT_UNAVAILABLE", "Слот только что заняли");
      }
      const booking = await tx.bookingRequest.create({
        data: {
          businessId,
          userId: input.userId ?? null,
          planItemId: input.planItemId ?? null,
          publicationType: PublicationType.OFFER,
          offerId: input.offerId,
          offerSessionId: sessionId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          seats,
          holdUntil,
          status: BookingStatus.NEW,
          customerName: input.customerName.trim(),
          childName: input.childName?.trim() || null,
          childAge: input.childAge ?? null,
          customerPhone: input.customerPhone.trim(),
          customerEmail: input.customerEmail?.trim() || null,
          customerComment: input.customerComment?.trim() || null,
          lastActivityAt: now,
        },
        select: { id: true },
      });
      await tx.bookingActivity.create({
        data: { bookingId: booking.id, type: "CREATED", actorType: "SYSTEM", payload: Prisma.JsonNull, createdAt: now },
      });
      if (unitId && blockStart && blockEnd) {
        await tx.bookingAllocation.create({
          data: {
            bookingUnitId: unitId,
            bookingRequestId: booking.id,
            blockStart,
            blockEnd,
            status: "HELD",
            expiresAt: holdUntil,
          },
        });
      }
      return { bookingId: booking.id, holdUntil };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new SlotReservationError("SLOT_UNAVAILABLE", "Слот только что заняли");
    }
    throw error;
  }
}

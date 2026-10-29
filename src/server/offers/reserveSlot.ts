import prisma from "@/lib/prisma";
import { parsePriceData } from "@/lib/priceItems";
import { BookingStatus, Prisma, PublicationType, ScheduleKind } from "@prisma/client";
import { loadSlotSnapshot } from "./getSlots";
import { calculateSlots, type SlotSnapshot } from "./slotAvailability";
import { dateKeyInZone, isoWeekday, localMinuteKey } from "./slotTime";

const MINUTE_MS = 60_000;
const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

export type ReserveSlotInput = {
  offerId: string;
  classGroupId?: string | null;
  classTariffId?: string | null;
  startsAt: Date;
  endsAt: Date;
  seats?: number;
  unitId?: string;
  /** Explicit all-or-nothing set of exclusive resources; cannot combine with unitId. */
  unitIds?: string[];
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
  if (existing?.capacity != null) return existing.capacity;
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
  const requestedUnits = input.unitIds;
  if (requestedUnits !== undefined &&
      (!Array.isArray(requestedUnits) || requestedUnits.length === 0 || requestedUnits.length > 8 ||
        requestedUnits.some((id) => typeof id !== "string" || !id.trim() || id.length > 128) ||
        new Set(requestedUnits).size !== requestedUnits.length || input.unitId !== undefined)) {
    throw new SlotReservationError("INVALID_SLOT", "Некорректный выбор ресурсов");
  }
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
        select: { status: true, priceItems: true, classGroups: { include: { tariffs: true, rules: true } }, place: { select: { ownerBusinessId: true } }, offerBooking: { select: { leadTimeHours: true, timezone: true } } },
      });
      const businessId = offer?.place?.ownerBusinessId;
      if (!offer || offer.status !== "PUBLISHED" || !businessId || !offer.offerBooking) {
        throw new SlotReservationError("OFFER_UNAVAILABLE", "Предложение сейчас недоступно для записи");
      }
      const groups = offer.classGroups.filter((group) => group.active);
      const group = input.classGroupId ? groups.find((item) => item.id === input.classGroupId) : null;
      if ((groups.length > 0 && !group) || (input.classGroupId && !group)) throw new SlotReservationError("INVALID_SLOT", "Выберите доступную группу");
      const structuredTariffs = group?.tariffs.filter((item) => item.active) ?? [];
      const legacyTariffs = parsePriceData(offer.priceItems).items;
      const tariff = structuredTariffs.length > 0
        ? structuredTariffs.find((item) => item.id === input.classTariffId)
        : !group ? legacyTariffs.find((item) => item.id === input.classTariffId) : null;
      if ((structuredTariffs.length > 0 || (!group && legacyTariffs.length > 0)) && !tariff) {
        throw new SlotReservationError("INVALID_SLOT", "Выберите доступный тариф");
      }
      if (input.classTariffId && !tariff) throw new SlotReservationError("INVALID_SLOT", "Тариф недоступен для выбранной группы");
      if (group && group.rules.length === 0) throw new SlotReservationError("INVALID_SLOT", "Расписание группы не задано");
      if (group) {
        const date = dateKeyInZone(input.startsAt, offer.offerBooking.timezone);
        const local = localMinuteKey(input.startsAt, offer.offerBooking.timezone);
        const minutes = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
        const belongsToGroup = group.rules.some((rule) =>
          rule.weekday === isoWeekday(date) && rule.startMinutes === minutes &&
          (!rule.validFrom || date >= rule.validFrom.toISOString().slice(0, 10)) &&
          (!rule.validTo || date <= rule.validTo.toISOString().slice(0, 10)));
        if (!belongsToGroup) throw new SlotReservationError("INVALID_SLOT", "Время не соответствует расписанию группы");
      }
      // Serialize reservations within the same class group; different groups keep separate quotas.
      if (group) {
        await tx.$queryRaw`SELECT "id" FROM "OfferClassGroup" WHERE "id" = ${group.id} AND "offerId" = ${input.offerId} FOR UPDATE`;
      }
      const query = { offerId: input.offerId, ...(group ? { classGroupId: group.id } : {}), from: input.startsAt, to: new Date(input.endsAt.getTime() + 1), requestedSeats: seats };
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
      const allocations: Array<{ unitId: string; blockStart: Date; blockEnd: Date }> = [];
      let selectedUnitIds: string[] = [];
      if (initial.scheduleKind === ScheduleKind.ON_REQUEST_WINDOWS) {
        selectedUnitIds = requestedUnits ??
          (input.unitId ? [input.unitId] :
            candidate.unitIds.length === 1 ? [candidate.unitIds[0]] : []);
        if (selectedUnitIds.length === 0) {
          throw new SlotReservationError("UNIT_REQUIRED", "Выберите конкретный ресурс для бронирования");
        }
        if (selectedUnitIds.some((id) => !candidate.unitIds.includes(id))) {
          throw new SlotReservationError("SLOT_UNAVAILABLE", "Один из ресурсов уже занят");
        }
        // All reservation pathways (including manual blocks and party confirmation)
        // lock BookingUnit before checking availability. Lock resources in a stable
        // order to avoid multi-resource deadlocks across concurrent bookings.
        for (const unitId of [...selectedUnitIds].sort()) {
          const lockedUnits = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "BookingUnit" WHERE "id" = ${unitId} FOR UPDATE
          `;
          if (lockedUnits.length !== 1) {
            throw new SlotReservationError("SLOT_UNAVAILABLE", "Ресурс больше не доступен");
          }
          // Expired HELD rows remain in the exclusion constraint until released.
          await tx.$executeRaw`UPDATE "BookingAllocation"
            SET "status" = 'EXPIRED', "updatedAt" = (now() AT TIME ZONE 'UTC')
            WHERE "bookingUnitId" = ${unitId} AND "status" = 'HELD'
              AND "expiresAt" < (now() AT TIME ZONE 'UTC')`;
          const unit = initial.units.find((item) => item.id === unitId)!;
          allocations.push({
            unitId,
            blockStart: new Date(input.startsAt.getTime() - unit.prepMinutes * MINUTE_MS),
            blockEnd: new Date(input.endsAt.getTime() +
              (unit.cleanupMinutes + initial.bufferMin) * MINUTE_MS),
          });
        }
      } else {
        if (input.unitId !== undefined || requestedUnits !== undefined) {
          throw new SlotReservationError("INVALID_SLOT", "Для групповой записи ресурсы выбирать не нужно");
        }
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

      // The row-lock wait may outlast the original preview or hold deadline.
      const checkedAt = new Date();
      if (holdUntil <= checkedAt) {
        throw new SlotReservationError("SLOT_UNAVAILABLE", "Время удержания слота истекло");
      }
      const current = await loadSlotSnapshot(query, tx);
      const checked = current && availableSlot(current, input, checkedAt);
      if (!checked || selectedUnitIds.some((id) => !checked.unitIds.includes(id))) {
        throw new SlotReservationError("SLOT_UNAVAILABLE", "Слот только что заняли");
      }
      const booking = await tx.bookingRequest.create({
        data: {
          businessId,
          userId: input.userId ?? null,
          planItemId: input.planItemId ?? null,
          publicationType: PublicationType.OFFER,
          offerId: input.offerId,
          classGroupId: group?.id ?? null,
          classGroupTitle: group?.title ?? null,
          classTariffId: tariff?.id ?? null,
          classTariffTitle: tariff ? ('title' in tariff ? tariff.title : tariff.label) : null,
          classTariffPrice: tariff?.price ?? null,
          classTariffUnit: tariff?.unit ?? null,
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
      // The request and EVERY required resource hold commit atomically.
      // A conflict on any later allocation rolls back all previous holds.
      for (const { unitId, blockStart, blockEnd } of allocations) {
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

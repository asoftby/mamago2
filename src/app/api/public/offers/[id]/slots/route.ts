import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { getSlots } from "@/server/offers/getSlots";
import { durationChoices } from "@/server/offers/bookingDuration";
import { dateKeyInZone, isoWeekday, localMinuteKey } from "@/server/offers/slotTime";

const DAY_MS = 86_400_000;
const MAX_RANGE_DAYS = 31;

/**
 * Read-only availability for public classes. Reservations must use the
 * transactional reserveSlot service, never the numbers returned here.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const query = request.nextUrl.searchParams;
  const fromText = query.get("from");
  const toText = query.get("to");
  const from = fromText ? new Date(fromText) : null;
  const to = toText ? new Date(toText) : null;
  const seatsText = query.get("seats") ?? "1";
  const seats = Number(seatsText);
  const durationText = query.get("durationMinutes");
  const duration = durationText === null ? null : Number(durationText);
  if (!from || !to || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) ||
      to <= from || to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS ||
      !/^\d+$/.test(seatsText) || !Number.isInteger(seats) || seats < 1 || seats > 100) {
    return NextResponse.json({ error: "Некорректный период или количество мест" }, { status: 400 });
  }

  const offer = await prisma.offer.findFirst({
    where: {
      id,
      ...getPublicPublishedOfferWhere(),
      productType: { in: ["REGULAR_ACTIVITY", "ONE_TIME_ACTIVITY"] },
      bookingEnabled: true,
      bookingMode: { in: ["USE_PUBLICATION_DATES", "USE_PUBLICATION_SLOTS"] },
    },
    select: { id: true, offerBooking: { select: {
      timezone: true, scheduleKind: true, durationMin: true, maxExtensionHours: true,
      extensionHourPriceByn: true, extensionDiscountPercent: true,
    } }, classGroups: { where: { active: true }, orderBy: { position: "asc" }, include: { tariffs: { where: { active: true }, orderBy: { position: "asc" } }, rules: true } } },
  });
  if (!offer) return NextResponse.json({ error: "Занятие недоступно для записи" }, { status: 404 });
  if (durationText !== null && (!/^\\d+$/.test(durationText) || !Number.isInteger(duration) ||
      !offer.offerBooking || offer.offerBooking.scheduleKind !== "ON_REQUEST_WINDOWS" ||
      !durationChoices({
        scheduleKind: offer.offerBooking.scheduleKind, durationMin: offer.offerBooking.durationMin,
        maxExtensionHours: offer.offerBooking.maxExtensionHours,
        extensionHourPriceByn: offer.offerBooking.extensionHourPriceByn?.toString() ?? null,
        extensionDiscountPercent: offer.offerBooking.extensionDiscountPercent,
        hasClassGroups: offer.classGroups.length > 0,
      }).includes(duration!))) {
    return NextResponse.json({ error: "Продолжительность недоступна" }, { status: 422 });
  }

  const legacySlots = offer.classGroups.length === 0
    ? await getSlots({ offerId: offer.id, from, to, requestedSeats: seats, ...(duration === null ? {} : { requestedDurationMinutes: duration }) })
    : [];
  const groups = await Promise.all(offer.classGroups.map(async (group) => {
    const scoped = await getSlots({ offerId: offer.id, classGroupId: group.id, from, to, requestedSeats: seats });
    return {
      id: group.id,
      title: group.title,
      tariffs: group.tariffs.map((tariff) => ({
        id: tariff.id, label: tariff.title, price: tariff.price, unit: tariff.unit, periodDays: tariff.periodDays,
      })),
      slots: scoped.map((slot) => ({
        startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(),
        remainingSeats: slot.remainingSeats, unitIds: slot.unitIds, sessionId: slot.sessionId ?? null,
      })),
    };
  }));
  const slots = legacySlots;
  return NextResponse.json({
    groups,
    slots: slots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      remainingSeats: slot.remainingSeats,
      unitIds: slot.unitIds,
      sessionId: slot.sessionId ?? null,
    })),
  });
}

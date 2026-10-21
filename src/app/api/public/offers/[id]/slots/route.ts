import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { getSlots } from "@/server/offers/getSlots";

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
    select: { id: true },
  });
  if (!offer) return NextResponse.json({ error: "Занятие недоступно для записи" }, { status: 404 });

  const slots = await getSlots({ offerId: offer.id, from, to, requestedSeats: seats });
  return NextResponse.json({
    slots: slots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      remainingSeats: slot.remainingSeats,
      unitIds: slot.unitIds,
      sessionId: slot.sessionId ?? null,
    })),
  });
}

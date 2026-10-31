import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { getSlots } from "@/server/offers/getSlots";

export const runtime = "nodejs";

/** Business-only, read-only preview using the same engine as reservation.
 * A preview does not guarantee availability; reserveSlot rechecks transactionally.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  const business = await getMyBusiness(user.id);
  if (!business || business.operationalStatus !== "ACTIVE")
    return NextResponse.json({ error: "Бизнес недоступен" }, { status: 403 });
  const { id } = await params;
  const offer = await prisma.offer.findFirst({
    where: { id, place: { ownerBusinessId: business.id },
      productType: { in: ["PARTY_SERVICE", "PARTY_PACKAGE"] } },
    select: { id: true, bookingEnabled: true, bookingMode: true, offerBooking: { select: { scheduleKind: true } } },
  });
  if (!offer) return NextResponse.json({ error: "Предложение недоступно" }, { status: 404 });
  if (!offer.bookingEnabled || !offer.offerBooking ||
      !["USE_PUBLICATION_SLOTS", "USE_PUBLICATION_DATES"].includes(offer.bookingMode ?? "")) {
    return NextResponse.json({ configured: false, slots: [],
      message: "Онлайн-бронирование не настроено. Ресурсные интервалы сами по себе не открывают запись." },
      { headers: { "Cache-Control": "private, no-store" } });
  }
  const from = new Date();
  const to = new Date(from.getTime() + 7 * 86_400_000);
  const slots = await getSlots({ offerId: id, from, to, requestedSeats: 1 });
  return NextResponse.json({ configured: true, slots: slots.slice(0, 100).map(slot => ({
    startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(),
    remainingSeats: slot.remainingSeats,
  })), message: "Предпросмотр не гарантирует бронь. Доступность проверяется при подтверждении." },
  { headers: { "Cache-Control": "private, no-store" } });
}

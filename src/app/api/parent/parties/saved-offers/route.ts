import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { DEFAULT_CITY_SLUG } from "@/lib/city/resolveCityContext";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";

const saveSchema = z.object({
  offerId: z.string().min(1).max(128),
  partyId: z.string().min(1).max(128).optional(),
  childName: z.string().trim().max(120).optional(),
}).strict();

/** Only the party owner may see their scenario choices. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const parties = await prisma.partyOrder.findMany({
      where: { ownerUserId: user.id, status: { not: "CANCELLED" } },
      select: { id: true, childName: true, eventDate: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({
      parties: parties.map(party => ({
        id: party.id, childName: party.childName,
        dateISO: party.eventDate?.toISOString().slice(0, 10) ?? null,
        status: party.status,
      })),
    });
  } catch (error) {
    console.error("List birthday scenarios error:", error);
    return NextResponse.json({ error: "Не удалось загрузить праздники" }, { status: 500 });
  }
}

/** A save-only reference; never sends a booking request or reserves inventory. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const parsed = saveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });

    const limit = await checkRateLimit("party_saved_offer:" + user.id, 30, 60 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });

    const { offerId, partyId, childName } = parsed.data;
    const offer = await prisma.offer.findFirst({
      where: { AND: [{ id: offerId }, getPublicPublishedOfferWhere()] },
      select: {
        id: true,
        city: { select: { slug: true } },
        place: { select: { city: { select: { slug: true } } } },
      },
    });
    if (!offer) return NextResponse.json({ error: "Предложение недоступно" }, { status: 404 });

    const citySlug = offer.city?.slug ?? offer.place?.city?.slug ?? DEFAULT_CITY_SLUG;
    if (!partyId && !(await findCityBySlug(citySlug, { select: { id: true }, isActive: true }))) {
      return NextResponse.json({ error: "Город недоступен" }, { status: 422 });
    }

    const outcome = await prisma.$transaction(async tx => {
      if (partyId) {
        const party = await tx.partyOrder.findFirst({
          where: { id: partyId, ownerUserId: user.id, status: { not: "CANCELLED" } },
          select: { id: true },
        });
        if (!party) return null;
        // Unique partyOrderId + offerId ensures repeat saves create no duplicate.
        await tx.partySavedOffer.createMany({
          data: [{ partyOrderId: party.id, offerId }],
          skipDuplicates: true,
        });
        return { partyId: party.id, created: false };
      }

      const party = await tx.partyOrder.create({
        data: {
          ownerUserId: user.id,
          citySlug,
          venueMode: "HOME",
          childName: childName?.trim() || null,
        },
        select: { id: true },
      });
      await tx.partySavedOffer.create({ data: { partyOrderId: party.id, offerId } });
      return { partyId: party.id, created: true };
    });

    if (!outcome) return NextResponse.json({ error: "Праздник не найден" }, { status: 404 });
    return NextResponse.json(outcome, { status: outcome.created ? 201 : 200 });
  } catch (error) {
    console.error("Save offer to birthday scenario error:", error);
    return NextResponse.json({ error: "Не удалось сохранить предложение" }, { status: 500 });
  }
}

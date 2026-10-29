import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import prisma from "@/lib/prisma";
import { saveBookingServices } from "@/server/offers/bookingServices.service";

export const runtime = "nodejs";

const amount = z.string().regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/);
const editorSchema = z.object({
  revision: z.number().int().nonnegative(),
  basePriceByn: amount.nullable(),
  options: z.array(z.object({
    id: z.string().min(1).max(128).optional(),
    title: z.string().trim().min(1).max(120),
    mode: z.enum(["INCLUDED", "OPTIONAL", "STANDALONE"]),
    priceByn: amount,
    bookingUnitId: z.string().min(1).max(128).nullable(),
    active: z.boolean(),
  }).strict()).max(20),
}).strict();

async function ownedOffer(id: string) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Требуется вход" }, { status: 401 }) };
  const offer = await prisma.offer.findUnique({
    where: { id },
    select: {
      id: true, currency: true, bookingEnabled: true, bookingMode: true,
      productType: true, classGroups: { where: { active: true }, select: { id: true } }, offerBooking: {
        select: { id: true, pricingRevision: true, basePriceByn: true, scheduleKind: true,
          options: { orderBy: { position: "asc" }, select: {
            id: true, title: true, mode: true, priceByn: true,
            bookingUnitId: true, active: true,
          } },
        },
      },
      place: { select: { id: true, ownerBusinessId: true, createdByUserId: true } },
    },
  });
  if (!offer?.place?.ownerBusinessId || !(await canManagePlaceAsync(user, offer.place))) {
    return { error: NextResponse.json({ error: "Предложение недоступно" }, { status: 404 }) };
  }
  return { offer, businessId: offer.place.ownerBusinessId };
}

/** Only linked ACTIVE inventory; no other business's resources may be edited. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await ownedOffer(id);
  if (ctx.error) return ctx.error;
  const offer = ctx.offer!;
  const units = await prisma.bookingUnitOffer.findMany({
    where: { offerId: id, bookingUnit: {
      businessId: ctx.businessId!, status: "ACTIVE", type: "EXCLUSIVE",
    } },
    select: { bookingUnit: { select: { id: true, name: true } } },
    orderBy: { bookingUnitId: "asc" },
  });
  return NextResponse.json({
    productType: offer.productType,
    currency: offer.currency,
    bookingEnabled: offer.bookingEnabled,
    bookingMode: offer.bookingMode,
    resourceExtrasAllowed: offer.classGroups.length === 0 &&\n      offer.offerBooking?.scheduleKind === "ON_REQUEST_WINDOWS",
    revision: offer.offerBooking?.pricingRevision ?? 0,
    basePriceByn: offer.offerBooking?.basePriceByn?.toFixed(2) ?? null,
    options: (offer.offerBooking?.options ?? []).map(option => ({
      ...option, priceByn: option.priceByn.toFixed(2),
    })),
    units: units.map(({ bookingUnit }) => bookingUnit),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Dedicated operational price update; does not rewrite Offer.priceItems,
 * class tariffs, party PackageComponent, or previously snapshotted bookings.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await ownedOffer(id);
  if (ctx.error) return ctx.error;
  const parsed = editorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте цены и выбранные услуги",
      issues: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;
  if (ctx.offer!.currency !== "BYN") {
    return NextResponse.json({ error: "Стоимость бронирования доступна только в BYN" }, { status: 422 });
  }
  try {
    const result = await saveBookingServices({
      offerId: id, businessId: ctx.businessId!, data: input,
    });
    if (result.status !== 200) return NextResponse.json({
      error: result.status === 409 ? "Цены изменились в другом окне. Обновите данные." :
        "Не удалось сохранить настройки — проверьте ресурсы и услуги",
    }, { status: result.status });
    return NextResponse.json({ ok: true, revision: result.revision },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[booking-services] update failed", error);
    return NextResponse.json({ error: "Не удалось сохранить услуги и цены" }, { status: 500 });
  }
}

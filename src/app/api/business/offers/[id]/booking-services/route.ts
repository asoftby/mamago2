import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import prisma from "@/lib/prisma";

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
      productType: true, offerBooking: {
        select: { id: true, pricingRevision: true, basePriceByn: true,
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
  const ids = input.options.flatMap(o => o.id ? [o.id] : []);
  if (new Set(ids).size !== ids.length || input.options.some(o =>
      o.mode === "INCLUDED" && o.priceByn !== "0" && Number(o.priceByn) !== 0 ||
      o.mode === "STANDALONE" && o.bookingUnitId !== null)) {
    return NextResponse.json({ error: "Некорректные настройки допуслуг" }, { status: 422 });
  }
  const resourceIds = [...new Set(input.options.flatMap(o => o.bookingUnitId ? [o.bookingUnitId] : []))];
  try {
    const result = await prisma.$transaction(async tx => {
      // Serialize simultaneous editors even on an offer without OfferBooking.
      await tx.$queryRaw`SELECT "id" FROM "Offer" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.offer.findUnique({
        where: { id }, select: { place: { select: { ownerBusinessId: true } },
          offerBooking: { select: { id: true, pricingRevision: true,
            options: { select: { id: true } } } } },
      });
      if (!current || current.place?.ownerBusinessId !== ctx.businessId) {
        return { status: 404 as const };
      }
      const present = current.offerBooking;
      if ((present?.pricingRevision ?? 0) !== input.revision) return { status: 409 as const };
      if (resourceIds.length > 0) {
        const linked = await tx.bookingUnitOffer.count({ where: {
          offerId: id, bookingUnitId: { in: resourceIds },
          bookingUnit: { businessId: ctx.businessId!, status: "ACTIVE", type: "EXCLUSIVE" },
        } });
        if (linked !== resourceIds.length) return { status: 422 as const };
      }
      const previousIds = new Set((present?.options ?? []).map(o => o.id));
      if (ids.some(x => !previousIds.has(x))) return { status: 422 as const };
      const booking = present ?? await tx.offerBooking.create({ data: { offerId: id },
        select: { id: true, pricingRevision: true } });
      // SQL/CAS-style revision; each edit is all-or-nothing.
      const changed = await tx.offerBooking.updateMany({ where: {
        id: booking.id, pricingRevision: input.revision,
      }, data: {
        basePriceByn: input.basePriceByn === null ? null : new Prisma.Decimal(input.basePriceByn),
        pricingRevision: { increment: 1 },
      } });
      if (changed.count !== 1) return { status: 409 as const };
      const retained = new Set(ids);
      await tx.offerBookingOption.deleteMany({ where: {
        offerBookingId: booking.id,
        ...(retained.size > 0 ? { id: { notIn: [...retained] } } : {}),
      } });
      for (const [position, option] of input.options.entries()) {
        const data = {
          title: option.title, mode: option.mode, active: option.active,
          position, bookingUnitId: option.bookingUnitId,
          priceByn: new Prisma.Decimal(option.priceByn),
        };
        if (option.id) {
          await tx.offerBookingOption.update({
            where: { id: option.id, offerBookingId: booking.id },
            data,
          });
        } else {
          await tx.offerBookingOption.create({ data: { ...data, offerBookingId: booking.id } });
        }
      }
      return { status: 200 as const, revision: input.revision + 1 };
    }, { timeout: 20_000 });
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

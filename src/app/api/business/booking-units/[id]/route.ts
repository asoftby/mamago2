import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { bookingUnitUpdateSchema } from "@/server/birthday/bookingUnitInput";

export const runtime = "nodejs";

class UnitEditError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

async function requireActiveBusiness() {
  const user = await getCurrentUser();
  if (!user) throw new UnitEditError(401, "Требуется вход");
  const business = await getMyBusiness(user.id);
  if (!business || business.operationalStatus !== "ACTIVE")
    throw new UnitEditError(403, "Бизнес недоступен");
  return business.id;
}

function errorResponse(error: unknown) {
  if (error instanceof UnitEditError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("[booking-unit] request failed");
  return NextResponse.json({ error: "Не удалось изменить ресурс" }, { status: 500 });
}

type Context = { params: Promise<{ id: string }> };

/** Own resource only. Returns the version needed to prevent lost updates. */
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const businessId = await requireActiveBusiness();
    const { id } = await params;
    const unit = await prisma.bookingUnit.findFirst({
      where: { id, businessId },
      select: {
        id: true, name: true, status: true, updatedAt: true,
        timezone: true, capacity: true, prepMinutes: true, cleanupMinutes: true,
        minDurationMinutes: true, stepMinutes: true,
        rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
        exceptions: { select: { date: true, kind: true, startMinutes: true, endMinutes: true } },
        offers: { select: { offerId: true } },
      },
    });
    if (!unit) throw new UnitEditError(404, "Ресурс не найден");
    return NextResponse.json({ unit }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

/**
 * Full replacement is deliberately conservative: any future confirmed
 * allocation or live HOLD prevents edits to the resource, its linked offers,
 * availability and capacity. Confirmation also locks BookingUnit FOR UPDATE.
 */
export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const businessId = await requireActiveBusiness();
    const { id } = await params;
    let raw: unknown;
    try { raw = await request.json(); }
    catch { throw new UnitEditError(400, "Некорректный JSON"); }
    const parsed = bookingUnitUpdateSchema.safeParse(raw);
    if (!parsed.success)
      return NextResponse.json({ error: "Некорректные настройки ресурса", issues: parsed.error.flatten() }, { status: 422 });
    const { expectedUpdatedAt, offerIds, rules, exceptions, ...fields } = parsed.data;
    const now = new Date();
    const unit = await prisma.$transaction(async (tx) => {
      // Match the lock order in lockAvailablePartyUnit to serialize with booking confirmations.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "BookingUnit"
        WHERE "id" = ${id} AND "businessId" = ${businessId}
        FOR UPDATE
      `;
      if (locked.length !== 1) throw new UnitEditError(404, "Ресурс не найден");

      const current = await tx.bookingUnit.findUnique({
        where: { id }, select: { updatedAt: true },
      });
      if (!current || current.updatedAt.toISOString() !== expectedUpdatedAt)
        throw new UnitEditError(409, "Настройки изменены. Обновите страницу.");

      const occupied = await tx.bookingAllocation.count({
        where: {
          bookingUnitId: id,
          blockEnd: { gt: now },
          OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: now } }],
        },
      });
      if (occupied > 0)
        throw new UnitEditError(409, "Есть будущие бронирования. Изменение ресурса недоступно.");

      // Offer ownership is through linked Place; never trust client-supplied IDs.
      const owned = await tx.offer.count({
        where: { id: { in: offerIds }, place: { ownerBusinessId: businessId } },
      });
      if (owned !== offerIds.length)
        throw new UnitEditError(403, "Услуги не принадлежат бизнесу");

      await tx.bookingUnitOffer.deleteMany({ where: { bookingUnitId: id } });
      await tx.bookingUnitOffer.createMany({
        data: offerIds.map(offerId => ({ bookingUnitId: id, offerId })),
      });
      await tx.availabilityRule.deleteMany({ where: { bookingUnitId: id } });
      await tx.availabilityRule.createMany({
        data: rules.map(rule => ({ bookingUnitId: id, ...rule })),
      });
      await tx.availabilityException.deleteMany({ where: { bookingUnitId: id } });
      if (exceptions.length > 0)
        await tx.availabilityException.createMany({
          data: exceptions.map(({ date, ...exception }) => ({
            bookingUnitId: id, date: new Date(date + "T00:00:00.000Z"), ...exception,
          })),
        });
      return tx.bookingUnit.update({
        where: { id },
        data: fields,
        select: { id: true, updatedAt: true, status: true },
      });
    });
    return NextResponse.json({ unit }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { bookingUnitCreateSchema } from "@/server/birthday/bookingUnitInput";

export const runtime = "nodejs";

async function requireBusiness() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: "Требуется вход" }, { status: 401 }) };
  const business = await getMyBusiness(user.id);
  if (!business || business.operationalStatus !== "ACTIVE")
    return { error: NextResponse.json({ error: "Бизнес недоступен" }, { status: 403 }) };
  return { business };
}

/** Business-owned resources only; no cross-business visibility. */
export async function GET() {
  const access = await requireBusiness();
  if (access.error) return access.error;
  const units = await prisma.bookingUnit.findMany({
    where: { businessId: access.business!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, status: true, timezone: true, capacity: true,
      prepMinutes: true, cleanupMinutes: true, minDurationMinutes: true, stepMinutes: true,
      rules: { select: { weekday: true, startMinutes: true, endMinutes: true } },
      offers: { select: { offerId: true } },
    },
  });
  return NextResponse.json({ units }, { headers: { "Cache-Control": "private, no-store" } });
}

/** First step of scheduling UI: create a resource and attach owned offers atomically. */
export async function POST(request: NextRequest) {
  const access = await requireBusiness();
  if (access.error) return access.error;
  const businessId = access.business!.id;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 }); }
  const parsed = bookingUnitCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Некорректное расписание", issues: parsed.error.flatten() }, { status: 422 });
  const { rules, offerIds, ...fields } = parsed.data;
  // Offer belongs to a business through its linked Place, not a direct businessId.
  // Keep this guard for every offer: no cross-business resource mappings.
  const owned = await prisma.offer.count({
    where: { id: { in: offerIds }, place: { ownerBusinessId: businessId } },
  });
  if (owned !== offerIds.length)
    return NextResponse.json({ error: "Услуги не принадлежат бизнесу" }, { status: 403 });
  const unit = await prisma.bookingUnit.create({
    data: {
      businessId, ...fields, timezone: "Europe/Minsk", type: "EXCLUSIVE",
      rules: { create: rules },
      offers: { create: offerIds.map(offerId => ({ offerId })) },
    },
    select: { id: true, name: true },
  });
  return NextResponse.json({ unit }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

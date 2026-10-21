import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";
import { confirmPartyRequest } from "@/server/birthday/partyConfirm.service";
import { checkRateLimit } from "@/lib/security/rateLimit";
import prisma from "@/lib/prisma";

/** Resource choices do not expose customer contact information. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  const business = await getMyBusiness(user.id);
  if (!business || business.operationalStatus !== "ACTIVE") {
    return NextResponse.json({ error: "Бизнес недоступен" }, { status: 403 });
  }
  const { id } = await params;
  const request = await prisma.bookingRequest.findFirst({
    where: { id, businessId: business.id, kind: "PARTY", partyStage: "AWAITING_RECONFIRM" },
    select: { offerId: true, partyOrderItem: {
      select: { role: true, partyOrder: { select: { venueMode: true } } },
    } },
  });
  if (!request?.offerId || !request.partyOrderItem) {
    return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  }
  const mappings = await prisma.bookingUnitOffer.findMany({
    where: { offerId: request.offerId, bookingUnit: {
      businessId: business.id, status: "ACTIVE",
    } },
    select: { bookingUnit: { select: {
      id: true, name: true, capacity: true, timezone: true,
    } } },
  });
  return NextResponse.json({
    requireUnit: request.partyOrderItem.role === "ANCHOR" &&
      ["VENUE", "PACKAGE"].includes(request.partyOrderItem.partyOrder.venueMode),
    units: mappings.map((row) => row.bookingUnit),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

const confirmSchema = z.object({
  expectedQuoteVersion: z.number().int().min(1),
  bookingUnitId: z.string().min(1).optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const business = await getMyBusiness(user.id);
    if (!business || business.operationalStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Бизнес недоступен" }, { status: 403 });
    }
    const key = request.headers.get("Idempotency-Key")?.trim();
    if (!key || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) {
      return NextResponse.json({ error: "Нужен корректный Idempotency-Key" }, { status: 400 });
    }
    const limit = await checkRateLimit("party_confirm:" + business.id, 60, 60 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    const { id } = await params;
    const body = confirmSchema.parse(await request.json());
    const result = await confirmPartyRequest({
      businessId: business.id,
      actorUserId: user.id,
      requestId: id,
      expectedQuoteVersion: body.expectedQuoteVersion,
      idempotencyKey: key,
      bookingUnitId: body.bookingUnitId,
    });
    return privatePartyResponse(result);
  } catch (error) {
    return partyRouteError(error);
  }
}

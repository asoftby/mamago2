import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { confirmPartyAnchor } from "@/server/birthday/partyConfirmation.service";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";

const bodySchema = z.object({
  expectedQuoteVersion: z.number().int().min(1),
  bookingUnitId: z.string().min(1).max(128),
}).strict();

export async function POST(request: NextRequest, {
  params,
}: { params: Promise<{ id: string }> }) {
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
    const body = bodySchema.parse(await request.json());
    const { id } = await params;
    const result = await confirmPartyAnchor({
      actorUserId: user.id, businessId: business.id, requestId: id,
      expectedQuoteVersion: body.expectedQuoteVersion,
      bookingUnitId: body.bookingUnitId,
      idempotencyKey: key,
    });
    return privatePartyResponse(result, result.alreadyProcessed ? 200 : 201);
  } catch (error) { return partyRouteError(error); }
}

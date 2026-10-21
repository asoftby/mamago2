import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";
import { confirmPartyRequest } from "@/server/birthday/partyConfirm.service";
import { checkRateLimit } from "@/lib/security/rateLimit";

const confirmSchema = z.object({
  expectedQuoteVersion: z.number().int().min(1),
  bookingUnitId: z.string().min(1).optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (process.env.PARTY_CONFIRMATION_ENABLED !== "true") {
      return NextResponse.json({ error: "Подтверждение праздников пока недоступно" }, { status: 503 });
    }
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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";
import { resolveExpiredPartyQuote } from "@/server/birthday/partyQuoteResolution.service";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("EXTEND"),
    expectedQuoteVersion: z.number().int().min(1),
    validUntil: z.string().datetime({ offset: true }),
  }).strict(),
  z.object({
    action: z.literal("CLOSE"),
    expectedQuoteVersion: z.number().int().min(1),
  }).strict(),
]);
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const business = await getMyBusiness(user.id);
    if (!business || business.operationalStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Бизнес недоступен" }, { status: 403 });
    }
    const key = request.headers.get("Idempotency-Key")?.trim();
    if (!key || key.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(key)) {
      return NextResponse.json({ error: "Нужен корректный Idempotency-Key" }, { status: 400 });
    }
    const body = schema.parse(await request.json());
    const { id } = await params;
    const result = await resolveExpiredPartyQuote({
      businessId: business.id, requestId: id, actorUserId: user.id, key,
      resolution: body.action === "EXTEND"
        ? { action: "EXTEND", expectedQuoteVersion: body.expectedQuoteVersion,
            validUntil: new Date(body.validUntil) }
        : { action: "CLOSE", expectedQuoteVersion: body.expectedQuoteVersion },
    });
    return privatePartyResponse(result, result.alreadyProcessed ? 200 : 201);
  } catch (error) {
    return partyRouteError(error);
  }
}

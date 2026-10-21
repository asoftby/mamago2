import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { acceptPartyQuote } from "@/server/birthday/partyConfirmation.service";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";

const bodySchema = z.object({ expectedQuoteVersion: z.number().int().min(1) }).strict();

export async function POST(request: NextRequest, {
  params,
}: { params: Promise<{ id: string; requestId: string }> }) {
  try {
    if (process.env.PARTY_CONFIRMATION_ENABLED !== "true" ||
        process.env.BUSINESS_BOOKINGS_INBOX_UI !== "true") {
      return NextResponse.json({ error: "Подтверждение праздников пока не включено" }, { status: 503 });
    }
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const key = request.headers.get("Idempotency-Key")?.trim();
    if (!key || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) {
      return NextResponse.json({ error: "Нужен корректный Idempotency-Key" }, { status: 400 });
    }
    const body = bodySchema.parse(await request.json());
    const { id, requestId } = await params;
    const result = await acceptPartyQuote({
      ownerUserId: user.id, partyId: id, requestId,
      expectedQuoteVersion: body.expectedQuoteVersion, idempotencyKey: key,
    });
    return privatePartyResponse(result, result.alreadyProcessed ? 200 : 201);
  } catch (error) { return partyRouteError(error); }
}

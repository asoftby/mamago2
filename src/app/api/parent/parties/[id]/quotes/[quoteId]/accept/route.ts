import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";
import { acceptPartyQuote } from "@/server/birthday/partyQuoteAcceptance.service";

const bodySchema = z.object({ requestId: z.string().min(1), expectedVersion: z.number().int().min(1) }).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> },
) {
  try {
    if (process.env.PARTY_CONFIRMATION_ENABLED !== "true") {
      return NextResponse.json({ error: "Подтверждение праздников пока недоступно" }, { status: 503 });
    }
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const limit = await checkRateLimit("party_quote_accept:" + user.id, 10, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    const body = bodySchema.parse(await request.json());
    const { id, quoteId } = await params;
    const result = await acceptPartyQuote({
      userId: user.id, orderId: id, quoteId,
      requestId: body.requestId,
      expectedVersion: body.expectedVersion,
    });
    return privatePartyResponse(result);
  } catch (error) {
    return partyRouteError(error);
  }
}

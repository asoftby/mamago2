import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";
import { cancelPartyBeforeConfirmation } from "@/server/birthday/partyCancel.service";

const bodySchema = z.object({ version: z.number().int().min(0) }).strict();

/** Parent cancels a party while no performer has confirmed anything (#818 D1). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const limit = await checkRateLimit("party_cancel:" + user.id, 10, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    const body = bodySchema.parse(await request.json());
    const { id } = await params;
    const result = await cancelPartyBeforeConfirmation(user.id, id, body.version);
    return privatePartyResponse({
      partyId: result.partyId, cancelled: result.cancelled, alreadyCancelled: result.alreadyCancelled,
    });
  } catch (error) {
    return partyRouteError(error);
  }
}

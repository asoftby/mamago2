import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { createPartyDraft } from "@/server/birthday/partyDraft.service";
import { createPartyDraftSchema } from "@/server/birthday/partyDraft.validation";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const limit = await checkRateLimit("party_draft:" + user.id, 10, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    const data = createPartyDraftSchema.parse(await request.json());
    const party = await createPartyDraft(user.id, data);
    return privatePartyResponse(party, 201);
  } catch (error) {
    return partyRouteError(error);
  }
}

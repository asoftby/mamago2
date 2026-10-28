import { NextRequest, NextResponse } from "next/server";
import { PartyCategory } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { findCandidatesForParty } from "@/server/birthday/partyOrderCandidates.service";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";

const querySchema = z.object({ category: z.nativeEnum(PartyCategory) }).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const limit = await checkRateLimit("birthday_candidates:" + user.id, 10, 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    const input = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { id } = await params;
    return privatePartyResponse(await findCandidatesForParty(user.id, id, input.category));
  } catch (error) {
    return partyRouteError(error);
  }
}

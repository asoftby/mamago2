import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { submitPartyAnchor } from "@/server/birthday/partySubmit.service";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";

const submitBodySchema = z.object({
  version: z.number().int().nonnegative(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const key = request.headers.get("Idempotency-Key")?.trim();
    if (!key || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) {
      return NextResponse.json({ error: "Нужен корректный Idempotency-Key" }, { status: 400 });
    }
    const limit = await checkRateLimit("party_submit:" + user.id, 10, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
    const input = submitBodySchema.parse(await request.json());
    const { id } = await params;
    const result = await submitPartyAnchor(user.id, id, input.version, key);
    return privatePartyResponse(result, result.alreadySubmitted ? 200 : 201);
  } catch (error) {
    return partyRouteError(error);
  }
}

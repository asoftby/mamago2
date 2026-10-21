import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { markPartyPrepaid } from "@/server/birthday/partyPrepaid.service";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";

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
    const { id } = await params;
    const result = await markPartyPrepaid({
      businessId: business.id, actorUserId: user.id, requestId: id, idempotencyKey: key,
    });
    return privatePartyResponse(result, result.alreadyMarked ? 200 : 201);
  } catch (error) {
    return partyRouteError(error);
  }
}

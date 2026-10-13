import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { partyBusinessReplySchema } from "@/server/birthday/partyBusiness.validation";
import { replyToPartyRequest } from "@/server/birthday/partyBusiness.service";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const business = await getMyBusiness(user.id);
    if (!business) return NextResponse.json({ error: "Нет доступа к бизнесу" }, { status: 403 });
    if (business.operationalStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Бизнес временно не может принимать заявки" }, { status: 403 });
    }
    const key = request.headers.get("Idempotency-Key")?.trim();
    if (!key || key.length > 128 || !/^[A-Za-z0-9_-]+$/.test(key)) {
      return NextResponse.json({ error: "Нужен корректный Idempotency-Key" }, { status: 400 });
    }
    const input = partyBusinessReplySchema.parse(await request.json());
    const { id } = await params;
    const result = await replyToPartyRequest({
      businessId: business.id, actorUserId: user.id, requestId: id, idempotencyKey: key, input,
    });
    return privatePartyResponse(result, result.alreadyResponded ? 200 : 201);
  } catch (error) {
    return partyRouteError(error);
  }
}

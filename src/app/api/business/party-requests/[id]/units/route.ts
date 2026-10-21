import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { listPartyConfirmChoices } from "@/server/birthday/partyConfirmChoices.service";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";

export async function GET(
  _request: NextRequest,
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
    const { id } = await params;
    return privatePartyResponse(await listPartyConfirmChoices(business.id, id));
  } catch (error) {
    return partyRouteError(error);
  }
}

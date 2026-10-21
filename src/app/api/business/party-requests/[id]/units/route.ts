import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { listConfirmablePartyUnits } from "@/server/birthday/partyConfirmation.service";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (process.env.PARTY_CONFIRMATION_ENABLED !== "true" ||
        process.env.BUSINESS_BOOKINGS_INBOX_UI !== "true") {
      return NextResponse.json({ error: "Подтверждение праздников пока не включено" }, { status: 503 });
    }
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const business = await getMyBusiness(user.id);
    if (!business || business.operationalStatus !== "ACTIVE") {
      return NextResponse.json({ error: "Бизнес недоступен" }, { status: 403 });
    }
    const { id } = await params;
    return privatePartyResponse(await listConfirmablePartyUnits({
      businessId: business.id, requestId: id,
    }));
  } catch (error) {
    return partyRouteError(error);
  }
}

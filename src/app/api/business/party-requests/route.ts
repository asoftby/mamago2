import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { listBusinessPartyRequests } from "@/server/birthday/partyBusiness.service";
import { privatePartyResponse } from "@/server/birthday/partyRouteResponses";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const business = await getMyBusiness(user.id);
    if (!business) return NextResponse.json({ error: "Нет доступа к бизнесу" }, { status: 403 });
    const attention = new URL(request.url).searchParams.get("filter") === "attention";
    return privatePartyResponse(await listBusinessPartyRequests(business.id, attention));
  } catch (error) {
    console.error("[party-business/list] failed", error);
    return NextResponse.json({ error: "Не удалось загрузить заявки" }, { status: 500 });
  }
}

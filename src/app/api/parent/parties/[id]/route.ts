import { programmeCommandSchema } from "@/lib/birthday/partyProgramme";
import { changePartyProgramme } from "@/server/birthday/partyPlan.service";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { readPartyOrder, updatePartyDraft } from "@/server/birthday/partyDraft.service";
import { updatePartyDraftSchema } from "@/server/birthday/partyDraft.validation";
import { partyRouteError, privatePartyResponse } from "@/server/birthday/partyRouteResponses";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const { id } = await params;
    return privatePartyResponse(await readPartyOrder(user.id, id));
  } catch (error) {
    return partyRouteError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    const { id } = await params;
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && "action" in body) {
      if (!user.emailVerifiedAt) return NextResponse.json({ error: "Подтвердите email" }, { status: 403 });
      return privatePartyResponse(await changePartyProgramme(user.id, id, programmeCommandSchema.parse(body)));
    }
    const data = updatePartyDraftSchema.parse(body);
    return privatePartyResponse(await updatePartyDraft(user.id, id, data));
  } catch (error) {
    return partyRouteError(error);
  }
}

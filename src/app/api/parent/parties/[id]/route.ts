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
    const data = updatePartyDraftSchema.parse(await request.json());
    return privatePartyResponse(await updatePartyDraft(user.id, id, data));
  } catch (error) {
    return partyRouteError(error);
  }
}

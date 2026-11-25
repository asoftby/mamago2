import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBusinessBookingDecisionAvailability } from "@/server/services/booking/bookingDecisionAvailability.service";

export const dynamic = "force-dynamic";

/** Never exposes the customer or children's identities; membership + tenant checked before lookup. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const business = await getMyBusiness(user.id, id);
  if (!business) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const decision = await getBusinessBookingDecisionAvailability(prisma, id, business.id);
  if (!decision) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
  return NextResponse.json(decision, { headers: { "Cache-Control": "private, no-store" } });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import {
  closePastStandardBooking, BookingOutcomeError,
} from "@/server/services/booking/bookingOutcome.service";

const outcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("HELD") }).strict(),
  z.object({
    outcome: z.literal("NOT_HELD"),
    reason: z.enum(["CLIENT_NO_SHOW", "CANCELLED_BY_PHONE"]),
  }).strict(),
]);
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const business = await getMyBusiness(user.id);
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 403 });
    const outcome = outcomeSchema.parse(await request.json());
    const { id } = await params;
    return NextResponse.json(await closePastStandardBooking({
      businessId: business.id, bookingId: id,
      actorId: user.id, actorRole: user.role, outcome,
    }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof BookingOutcomeError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid outcome or reason", details: error.issues }, { status: 400 });
    }
    console.error("[business/bookings/outcome]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

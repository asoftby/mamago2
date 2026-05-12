/**
 * GET /api/business/bookings/[id]/activity
 *
 * Возвращает историю событий заявки (timeline).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { getBookingActivities } from "@/server/services/booking/bookingActivity.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { id } = await params;

    // Verify ownership
    const booking = await prisma.bookingRequest.findUnique({
      where: { id },
      select: { businessId: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.businessId !== business.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const activities = await getBookingActivities(id);
    return NextResponse.json({ activities });
  } catch (err) {
    console.error("[GET /api/business/bookings/[id]/activity]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

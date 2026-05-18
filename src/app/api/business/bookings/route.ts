import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { BookingStatus } from "@prisma/client";
import { getBusinessBookings } from "@/server/services/booking/bookingQuery.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const dateParam = searchParams.get("date");
    const weekStartParam = searchParams.get("weekStart");

    const status =
      statusParam && Object.values(BookingStatus).includes(statusParam as BookingStatus)
        ? (statusParam as BookingStatus)
        : undefined;

    const date = dateParam ? new Date(dateParam) : undefined;
    const weekStart = weekStartParam ? new Date(weekStartParam) : undefined;

    const result = await getBusinessBookings({
      businessId: business.id,
      status,
      date,
      weekStart,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/business/bookings]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

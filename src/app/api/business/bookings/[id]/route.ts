import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { z } from "zod";
import { BookingStatus } from "@prisma/client";
import {
  updateBookingStatus,
  BookingOwnershipError,
  BookingStatusTransitionError,
} from "@/server/services/booking/bookingQuery.service";

const updateBookingSchema = z.object({
  status: z.enum([
    BookingStatus.CONFIRMED,
    BookingStatus.REJECTED,
    BookingStatus.COMPLETED,
  ]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const body = await request.json();
    const data = updateBookingSchema.parse(body);
    const { id } = await params;

    const updatedBooking = await updateBookingStatus(id, business.id, data.status, {
      actorId: user.id,
      actorRole: user.role,
      metadata: {
        source: "business_legacy_patch_route",
      },
    });

    return NextResponse.json(updatedBooking);

  } catch (error) {
    if (error instanceof BookingOwnershipError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof BookingStatusTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error)?.message === "Заявка не найдена") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    console.error("Update booking error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

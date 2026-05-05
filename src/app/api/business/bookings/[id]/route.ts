import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { BookingStatus } from "@prisma/client";

const updateBookingSchema = z.object({
  status: z.enum([
    BookingStatus.CONFIRMED,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
  ]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Verify booking belongs to this business
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: params.id },
      select: { businessId: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.businessId !== business.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update booking status
    const updatedBooking = await prisma.bookingRequest.update({
      where: { id: params.id },
      data: {
        status: data.status,
      },
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        offer: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        place: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        session: {
          select: {
            id: true,
            startsAt: true,
          },
        },
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(updatedBooking);

  } catch (error) {
    console.error("Update booking error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

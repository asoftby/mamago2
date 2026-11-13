import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { PublicationType } from "@prisma/client";
import { checkRateLimit } from "@/lib/security/rateLimit";
import {
  createPublicBooking,
  BookingNotFoundError,
  BookingValidationError,
} from "@/server/services/booking/booking.service";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { BOOKING_MAX_ADULTS, bookingChildrenInputSchema } from "@/lib/booking/bookingParticipants";

const createBookingSchema = z.object({
  publicationType: z.nativeEnum(PublicationType),
  publicationId: z.string(),
  selectedSessionId: z.string().optional(),
  requestedDate: z.string().optional(),
  requestedTime: z.string().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerComment: z.string().optional(),
  adultsCount: z.number().int().min(0).max(100).default(1),
  childrenCount: z.number().int().min(0).max(100).default(0),
  /** Состав группы (события). Если передан, `childrenCount` пересчитывается сервером. */
  children: bookingChildrenInputSchema.optional(),
  planItemId: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  if (value.children === undefined) return;
  if (value.adultsCount < 1 || value.adultsCount > BOOKING_MAX_ADULTS) {
    ctx.addIssue({ code: "custom", path: ["adultsCount"], message: `Взрослых должно быть от 1 до ${BOOKING_MAX_ADULTS}` });
  }
});

export async function POST(request: NextRequest) {
  try {
    const ip = getTrustedClientIp(request) ?? "unknown";
    const rateLimit = await checkRateLimit(`booking_create:${ip}`, 10, 10 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const user = await getCurrentUser();
    
    const body = await request.json();
    const data = createBookingSchema.parse(body);

    const result = await createPublicBooking({
      publicationType: data.publicationType,
      publicationId: data.publicationId,
      selectedSessionId: data.selectedSessionId ?? null,
      requestedDate: data.requestedDate ?? null,
      requestedTime: data.requestedTime ?? null,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail ?? null,
      customerComment: data.customerComment ?? null,
      adultsCount: data.adultsCount,
      childrenCount: data.childrenCount,
      children: data.children,
      userId: user?.id ?? null,
      planItemId: data.planItemId ?? null,
    });

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: result.bookingId },
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
      },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking created but could not be loaded" },
        { status: 500 },
      );
    }

    return NextResponse.json(booking, { status: 201 });

  } catch (error) {
    console.error("Create booking error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof BookingValidationError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 400 },
      );
    }

    if (error instanceof BookingNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

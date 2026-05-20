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
  adultsCount: z.number().int().min(0).default(1),
  childrenCount: z.number().int().min(0).default(0),
});

function getClientIp(request: NextRequest): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff
      .split(",")
      .map((part) => part.trim())
      .find(Boolean);
    if (first) return first;
  }

  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`booking_create:${ip}`, 10, 10 * 60 * 1000);
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
      userId: user?.id ?? null,
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

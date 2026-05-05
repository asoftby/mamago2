import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { PublicationType, BookingMode, BookingStatus } from "@prisma/client";

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

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    const body = await request.json();
    const data = createBookingSchema.parse(body);

    // Get publication and verify booking is enabled
    let publication: any = null;
    let businessId: string | null = null;

    if (data.publicationType === PublicationType.EVENT) {
      publication = await prisma.activity.findUnique({
        where: { id: data.publicationId },
        select: {
          id: true,
          bookingEnabled: true,
          bookingMode: true,
          businessId: true,
        },
      });
      businessId = publication?.businessId;
    } else if (data.publicationType === PublicationType.OFFER) {
      publication = await prisma.offer.findUnique({
        where: { id: data.publicationId },
        select: {
          id: true,
          bookingEnabled: true,
          bookingMode: true,
          place: {
            select: {
              ownerBusinessId: true,
            },
          },
        },
      });
      businessId = publication?.place?.ownerBusinessId;
    } else if (data.publicationType === PublicationType.PLACE) {
      publication = await prisma.place.findUnique({
        where: { id: data.publicationId },
        select: {
          id: true,
          bookingEnabled: true,
          ownerBusinessId: true,
        },
      });
      businessId = publication?.ownerBusinessId;
    }

    if (!publication) {
      return NextResponse.json({ error: "Publication not found" }, { status: 404 });
    }

    if (!publication.bookingEnabled) {
      return NextResponse.json({ error: "Booking not enabled for this publication" }, { status: 400 });
    }

    if (!businessId) {
      return NextResponse.json({ error: "Business not found for this publication" }, { status: 400 });
    }

    // Validate selected session if provided
    if (data.selectedSessionId) {
      if (data.publicationType !== PublicationType.EVENT) {
        return NextResponse.json({ error: "Sessions are only available for events" }, { status: 400 });
      }

      const session = await prisma.activitySession.findUnique({
        where: { id: data.selectedSessionId },
        select: { activityId: true, startsAt: true },
      });

      if (!session || session.activityId !== data.publicationId) {
        return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }
    }

    // Validate booking mode requirements
    if (publication.bookingMode === BookingMode.USE_PUBLICATION_SLOTS && !data.selectedSessionId) {
      return NextResponse.json({ error: "Session selection required" }, { status: 400 });
    }

    if (publication.bookingMode === BookingMode.USE_PUBLICATION_DATES && !data.requestedDate) {
      return NextResponse.json({ error: "Date selection required" }, { status: 400 });
    }

    // Create booking request
    const bookingData: any = {
      businessId,
      userId: user?.id,
      publicationType: data.publicationType,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail,
      customerComment: data.customerComment,
      adultsCount: data.adultsCount,
      childrenCount: data.childrenCount,
      status: BookingStatus.NEW,
    };

    // Set publication reference
    if (data.publicationType === PublicationType.EVENT) {
      bookingData.activityId = data.publicationId;
    } else if (data.publicationType === PublicationType.OFFER) {
      bookingData.offerId = data.publicationId;
    } else if (data.publicationType === PublicationType.PLACE) {
      bookingData.placeId = data.publicationId;
    }

    // Set date/time/session
    if (data.selectedSessionId) {
      bookingData.selectedSessionId = data.selectedSessionId;
    }
    if (data.requestedDate) {
      bookingData.requestedDate = new Date(data.requestedDate);
    }
    if (data.requestedTime) {
      bookingData.requestedTime = data.requestedTime;
    }

    const booking = await prisma.bookingRequest.create({
      data: bookingData,
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

    return NextResponse.json(booking, { status: 201 });

  } catch (error) {
    console.error("Create booking error:", error);
    
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

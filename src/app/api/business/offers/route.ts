import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const createOfferSchema = z.object({
  source: z.enum(["PLACE", "EVENT"]),
  selectedPlace: z.object({
    id: z.string(),
  }).optional(),
  selectedEvent: z.object({
    id: z.string(),
  }).optional(),
  kind: z.enum(["VISIT", "CLASS", "PARTY", "EVENT_TICKET"]),
  title: z.string().min(1),
  shortDescription: z.string().min(1),
  ageMinMonths: z.number().optional(),
  ageMaxMonths: z.number().optional(),
  coverImage: z.string().optional(),
  pricingMode: z.enum(["SINGLE", "MULTIPLE"]),
  singlePrice: z.number().optional(),
  singlePriceLabel: z.string().optional(),
  pricingOptions: z.array(z.object({
    title: z.string(),
    price: z.number(),
    oldPrice: z.number().optional(),
    description: z.string().optional(),
  })).default([]),
  ctaType: z.enum(["BOOK", "RESERVE", "BUY_TICKET", "SEND_REQUEST", "VISIT_WEBSITE"]),
  phone: z.string().optional(),
  website: z.string().optional(),
  bookingInstructions: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING"]).default("DRAFT"),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createOfferSchema.parse(body);

    // Verify place ownership if source is PLACE
    if (data.source === "PLACE" && data.selectedPlace) {
      const place = await prisma.place.findFirst({
        where: {
          id: data.selectedPlace.id,
          ownerUserId: user.id,
        },
      });

      if (!place) {
        return NextResponse.json({ error: "Place not found" }, { status: 404 });
      }

      // Map offer kind to database enum
      const dbKind = data.kind === "EVENT_TICKET" ? "EVENT" : "SERVICE";

      // Calculate price fields
      let priceFrom: number | null = null;
      let priceText: string | null = null;

      if (data.pricingMode === "SINGLE" && data.singlePrice) {
        priceFrom = data.singlePrice;
        priceText = data.singlePriceLabel || null;
      } else if (data.pricingMode === "MULTIPLE" && data.pricingOptions.length > 0) {
        priceFrom = Math.min(...data.pricingOptions.map(p => p.price));
        priceText = `от ${priceFrom} BYN`;
      }

      const offer = await prisma.offer.create({
        data: {
          placeId: place.id,
          kind: dbKind,
          title: data.title,
          description: data.shortDescription,
          coverImage: data.coverImage,
          priceFrom,
          priceText,
          ageMinMonths: data.ageMinMonths,
          ageMaxMonths: data.ageMaxMonths,
          status: data.status,
        },
      });

      return NextResponse.json(offer);
    }

    // TODO: Handle EVENT source when event API is available
    return NextResponse.json({ error: "Event source not yet supported" }, { status: 400 });

  } catch (error) {
    console.error("Create offer error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's places
    const userPlaces = await prisma.place.findMany({
      where: { ownerUserId: user.id },
      select: { id: true },
    });

    const placeIds = userPlaces.map(p => p.id);

    const offers = placeIds.length > 0
      ? await prisma.offer.findMany({
          where: {
            placeId: { in: placeIds },
          },
          include: {
            place: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return NextResponse.json(offers);

  } catch (error) {
    console.error("Get offers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
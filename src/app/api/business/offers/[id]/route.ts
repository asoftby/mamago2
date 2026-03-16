import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const updateOfferSchema = z.object({
  title: z.string().min(1).optional(),
  shortDescription: z.string().min(1).optional(),
  ageMinMonths: z.number().optional(),
  ageMaxMonths: z.number().optional(),
  coverImage: z.string().optional(),
  pricingMode: z.enum(["SINGLE", "MULTIPLE"]).optional(),
  singlePrice: z.number().optional(),
  singlePriceLabel: z.string().optional(),
  pricingOptions: z.array(z.object({
    title: z.string(),
    price: z.number(),
    oldPrice: z.number().optional(),
    description: z.string().optional(),
  })).optional(),
  ctaType: z.enum(["BOOK", "RESERVE", "BUY_TICKET", "SEND_REQUEST", "VISIT_WEBSITE"]).optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  bookingInstructions: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const offer = await prisma.offer.findFirst({
      where: {
        id,
        place: {
          ownerUserId: user.id,
        },
      },
      include: {
        place: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    return NextResponse.json(offer);

  } catch (error) {
    console.error("Get offer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateOfferSchema.parse(body);

    // Verify offer ownership
    const existingOffer = await prisma.offer.findFirst({
      where: {
        id,
        place: {
          ownerUserId: user.id,
        },
      },
    });

    if (!existingOffer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // Calculate price fields if pricing data is provided
    let priceFrom: number | null = existingOffer.priceFrom;
    let priceText: string | null = existingOffer.priceText;

    if (data.pricingMode === "SINGLE" && data.singlePrice !== undefined) {
      priceFrom = data.singlePrice;
      priceText = data.singlePriceLabel || null;
    } else if (data.pricingMode === "MULTIPLE" && data.pricingOptions && data.pricingOptions.length > 0) {
      priceFrom = Math.min(...data.pricingOptions.map(p => p.price));
      priceText = `от ${priceFrom} BYN`;
    }

    const updateData: any = {};
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.shortDescription !== undefined) updateData.description = data.shortDescription;
    if (data.ageMinMonths !== undefined) updateData.ageMinMonths = data.ageMinMonths;
    if (data.ageMaxMonths !== undefined) updateData.ageMaxMonths = data.ageMaxMonths;
    if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
    if (data.status !== undefined) updateData.status = data.status;
    
    // Update price fields if they were recalculated
    if (priceFrom !== existingOffer.priceFrom) updateData.priceFrom = priceFrom;
    if (priceText !== existingOffer.priceText) updateData.priceText = priceText;

    const offer = await prisma.offer.update({
      where: { id },
      data: updateData,
      include: {
        place: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json(offer);

  } catch (error) {
    console.error("Update offer error:", error);
    
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify offer ownership and that it's a draft
    const offer = await prisma.offer.findFirst({
      where: {
        id,
        place: {
          ownerUserId: user.id,
        },
        status: "DRAFT", // Only allow deleting drafts
      },
    });

    if (!offer) {
      return NextResponse.json(
        { error: "Offer not found or cannot be deleted" },
        { status: 404 }
      );
    }

    await prisma.offer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Delete offer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
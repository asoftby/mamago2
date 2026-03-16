import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";

/**
 * GET /api/business/events/[id]
 * Get single event by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const event = await prisma.activity.findFirst({
      where: {
        id: params.id,
        ownerUserId: user.id,
        type: ActivityType.EVENT,
      },
      include: {
        place: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
          },
        },
        images: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        sessions: {
          orderBy: {
            startsAt: "asc",
          },
        },
        filterOptions: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error: any) {
    console.error("Get event error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get event" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/business/events/[id]
 * Update event draft
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Verify ownership
    const existing = await prisma.activity.findFirst({
      where: {
        id: params.id,
        ownerUserId: user.id,
        type: ActivityType.EVENT,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Update event
    const event = await prisma.activity.update({
      where: {
        id: params.id,
      },
      data: {
        title: body.title,
        shortDesc: body.shortDesc,
        description: body.description,
        ageTags: body.ageTags,
        scheduleMode: body.scheduleMode,
        scheduleJson: body.scheduleJson,
        priceFrom: body.priceFrom,
        priceTo: body.priceTo,
        priceText: body.priceText,
        currency: body.currency,
        coverImageId: body.coverImageId,
        placeId: body.placeId,
        businessId: body.businessId,
      },
    });

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
      },
    });
  } catch (error: any) {
    console.error("Update event error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update event" },
      { status: 500 }
    );
  }
}

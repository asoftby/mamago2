import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus, ActivityType, ScheduleMode } from "@prisma/client";

/**
 * POST /api/business/events
 * Create new event (draft)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Create event as draft
    const event = await prisma.activity.create({
      data: {
        type: ActivityType.EVENT,
        status: ContentStatus.DRAFT,
        ownerUserId: user.id,
        
        // Basic info
        title: body.title || "Новое событие",
        shortDesc: body.shortDesc || "",
        description: body.description || "",
        
        // Age
        ageTags: body.ageTags || [],
        
        // Schedule
        scheduleMode: ScheduleMode.SPECIFIC_DATES,
        scheduleJson: body.scheduleJson || {},
        
        // Pricing
        priceFrom: body.priceFrom,
        priceTo: body.priceTo,
        priceText: body.priceText,
        currency: body.currency || "BYN",
        
        // Images
        coverImageId: body.coverImageId,
        
        // Location
        placeId: body.placeId,
        
        // Business
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
    console.error("Create event error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create event" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/business/events
 * List user's events
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const events = await prisma.activity.findMany({
      where: {
        ownerUserId: user.id,
        type: ActivityType.EVENT,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        place: {
          select: {
            id: true,
            title: true,
          },
        },
        images: true,
        sessions: {
          orderBy: {
            startAt: "asc",
          },
          take: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error: any) {
    console.error("List events error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list events" },
      { status: 500 }
    );
  }
}

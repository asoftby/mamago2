import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus, ActivityType, ScheduleMode, Prisma } from "@prisma/client";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import { syncEventVenueAndActivityCity } from "@/lib/business/syncEventVenueFromWizard";
import { computeEventShortDesc } from "@/lib/business/eventShortDesc";
import { excludeDeletedEvents, excludeGhostEventDrafts } from "@/lib/business/eventListWhere";
import { validateEventProgramCategories } from "@/lib/business/validateEventProgramCategories";
import { assertBusinessEventPrimaryCategory } from "@/lib/business/validatePrimaryEventCategory";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";

/**
 * POST /api/business/events
 * Create new event (draft)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const title = typeof body.title === "string" && body.title.trim() ? body.title : "Новое событие";
    const description = typeof body.description === "string" ? body.description : "";

    const mergedPlaceId =
      typeof body.placeId === "string"
        ? body.placeId
        : body.venue?.kind === "PLACE" && typeof body.venue?.placeId === "string"
          ? body.venue.placeId
          : undefined;

    const scheduleJsonUnknown =
      (body.scheduleJson && typeof body.scheduleJson === "object")
        ? (body.scheduleJson as Record<string, unknown>)
        : {};
    const primaryRootCategoryId =
      typeof scheduleJsonUnknown.categoryId === "string" ? scheduleJsonUnknown.categoryId : null;
    const primaryLeafCategoryId =
      typeof body.eventCategoryId === "string" ? body.eventCategoryId : null;

    assertBusinessEventPrimaryCategory({
      eventCategoryId: primaryLeafCategoryId,
      scheduleJson: scheduleJsonUnknown,
    });

    const { programCategoryIds } = await validateEventProgramCategories({
      primaryRootCategoryId,
      primaryLeafCategoryId,
      programCategoryIds: body.programCategoryIds,
    });

    // Create event as draft
    const event = await prisma.activity.create({
      data: {
        type: ActivityType.EVENT,
        status: ContentStatus.DRAFT,
        ownerUserId: user.id,
        
        // Basic info
        title,
        shortDesc: computeEventShortDesc({ title, fullDescriptionHtml: description }),
        description,
        
        // Age
        ageTags: body.ageTags || [],
        
        // Schedule
        scheduleMode: ScheduleMode.MULTI_DATE,
        scheduleJson: (body.scheduleJson ?? {}) as Prisma.InputJsonValue,
        
        // Event category (leaf: subcategory if selected, otherwise root)
        eventCategoryId:
          typeof body.eventCategoryId === "string" ? body.eventCategoryId : undefined,
        programCategoryLinks:
          programCategoryIds.length > 0
            ? {
                createMany: {
                  data: programCategoryIds.map((categoryId) => ({ categoryId })),
                  skipDuplicates: true,
                },
              }
            : undefined,

        // Pricing
        priceFrom: body.priceFrom,
        priceTo: body.priceTo,
        priceText: body.priceText,
        currency: body.currency || "BYN",
        
        // Images
        coverImageId: body.coverImageId,
        
        // Location
        ...(mergedPlaceId !== undefined ? { placeId: mergedPlaceId } : {}),
        
        // Business
        businessId: body.businessId,
      },
    });

    await replaceActivitySessionsFromScheduleJson(event.id, event.scheduleJson);
    if (body.venue !== undefined) {
      await syncEventVenueAndActivityCity(
        event.id,
        body.venue,
        mergedPlaceId,
      );
    } else if (mergedPlaceId !== undefined) {
      await syncEventVenueAndActivityCity(event.id, null, mergedPlaceId);
    }

    await assignActivitySlugIfMissing(event.id, title);

    const slugRow = await prisma.activity.findUnique({
      where: { id: event.id },
      select: { slug: true },
    });

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        slug: slugRow?.slug ?? null,
      },
    });
  } catch (error: any) {
    console.error("Create event error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const events = await prisma.activity.findMany({
      where: {
        type: ActivityType.EVENT,
        ...(user.role === "ADMIN" || user.role === "MODERATOR"
          ? {}
          : { ownerUserId: user.id }),
        ...excludeDeletedEvents(),
        ...excludeGhostEventDrafts(),
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
            startsAt: "asc",
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

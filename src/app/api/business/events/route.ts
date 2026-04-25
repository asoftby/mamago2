import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus, ActivityType, ScheduleMode, Prisma } from "@prisma/client";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import {
  buildActivityManageWhereForUser,
  coalesceActivityBusinessIdFromPlace,
  getBusinessIdsUserCanAccess,
} from "@/lib/auth/activityAccess";
import { getUserBusinessId } from "@/lib/auth/placeAccess";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import { syncEventVenueAndActivityCity } from "@/lib/business/syncEventVenueFromWizard";
import { computeEventShortDesc } from "@/lib/business/eventShortDesc";
import { excludeDeletedEvents, excludeGhostEventDrafts } from "@/lib/business/eventListWhere";
import { validateEventProgramCategories } from "@/lib/business/validateEventProgramCategories";
import { assertBusinessEventPrimaryCategory } from "@/lib/business/validatePrimaryEventCategory";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";
import { replaceActivityGalleryFromMediaIds } from "@/lib/business/syncEventGalleryFromMediaIds";
import { resolveEventOrganizer } from "@/lib/business/eventOrganizer";
import { prismaBase } from "@/lib/prisma";
import { DEFAULT_ACTIVITY_FORMAT, normalizeActivityFormat } from "@/domain/activities/activity-format";

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
    const organizerResolution =
      body.organizerInput && typeof body.organizerInput === "object"
        ? await resolveEventOrganizer(prismaBase, body.organizerInput)
        : { organizerId: typeof body.organizerId === "string" ? body.organizerId : null, organizerSnapshot: null };
    const scheduleJsonWithOrganizer: Record<string, unknown> = {
      ...scheduleJsonUnknown,
      ...(organizerResolution.organizerSnapshot
        ? { organizer: organizerResolution.organizerSnapshot }
        : {}),
    };
    const primaryRootCategoryId =
      typeof scheduleJsonWithOrganizer.categoryId === "string" ? scheduleJsonWithOrganizer.categoryId : null;
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

    let resolvedBusinessId: string | null =
      typeof body.businessId === "string" ? body.businessId : null;

    if (typeof mergedPlaceId === "string" && mergedPlaceId.length > 0) {
      const placeRow = await prisma.place.findUnique({
        where: { id: mergedPlaceId },
        select: { ownerBusinessId: true },
      });
      if (!placeRow) {
        return NextResponse.json(
          { error: "Place not found" },
          { status: 404 },
        );
      }
      resolvedBusinessId = coalesceActivityBusinessIdFromPlace(
        placeRow,
        resolvedBusinessId,
      );
    } else if (!resolvedBusinessId) {
      resolvedBusinessId = await getUserBusinessId(user.id);
    }

    // Create event as draft
    const event = await prisma.activity.create({
      data: {
        type: ActivityType.EVENT,
        status: ContentStatus.DRAFT,
        ownerUserId: user.id,
        
        // Basic info
        title,
        format: normalizeActivityFormat(body.format, DEFAULT_ACTIVITY_FORMAT),
        shortDesc: computeEventShortDesc({ title, fullDescriptionHtml: description }),
        description,
        
        // Age
        ageTags: body.ageTags || [],
        
        // Schedule
        scheduleMode: ScheduleMode.MULTI_DATE,
        scheduleJson: scheduleJsonWithOrganizer as Prisma.InputJsonValue,
        
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
        businessId: resolvedBusinessId,
        organizerId: organizerResolution.organizerId,
      },
    });

    await replaceActivitySessionsFromScheduleJson(event.id, event.scheduleJson);
    await replaceActivityGalleryFromMediaIds(
      event.id,
      Array.isArray(body.galleryMediaIds) ? body.galleryMediaIds.filter((id: unknown): id is string => typeof id === "string") : [],
      typeof body.coverImageId === "string" ? body.coverImageId : null,
    );
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
  } catch (error: unknown) {
    console.error("Create event error:", error);
    const message = error instanceof Error ? error.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
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

    const manageWhere =
      user.role === "ADMIN" || user.role === "MODERATOR"
        ? {}
        : buildActivityManageWhereForUser(
            user.id,
            await getBusinessIdsUserCanAccess(user.id),
          );

    const events = await prisma.activity.findMany({
      where: {
        type: ActivityType.EVENT,
        ...manageWhere,
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
  } catch (error: unknown) {
    console.error("List events error:", error);
    const message = error instanceof Error ? error.message : "Failed to list events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

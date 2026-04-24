import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType, Prisma } from "@prisma/client";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import {
  canManageActivityById,
  coalesceActivityBusinessIdFromPlace,
} from "@/lib/auth/activityAccess";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import { syncEventVenueAndActivityCity } from "@/lib/business/syncEventVenueFromWizard";
import { computeEventShortDesc } from "@/lib/business/eventShortDesc";
import { softDeleteActivityById } from "@/lib/activity/softDeleteActivity";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";
import { validateEventProgramCategories } from "@/lib/business/validateEventProgramCategories";
import { assertBusinessEventPrimaryCategory } from "@/lib/business/validatePrimaryEventCategory";
import { replaceActivityGalleryFromMediaIds } from "@/lib/business/syncEventGalleryFromMediaIds";
import { resolveEventOrganizer } from "@/lib/business/eventOrganizer";
import { prismaBase } from "@/lib/prisma";

/**
 * GET /api/business/events/[id]
 * Get single event by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const event = await prisma.activity.findFirst({
      where: {
        id,
        type: ActivityType.EVENT,
      },
      include: {
        place: {
          select: {
            id: true,
            title: true,
            formattedAddr: true,
            city: true,
          },
        },
        programCategoryLinks: {
          select: { categoryId: true },
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
        organizer: true,
        filterOptions: true,
        venue: true,
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
  } catch (error: unknown) {
    console.error("Get event error:", error);
    const message = error instanceof Error ? error.message : "Failed to get event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/business/events/[id]
 * Update event draft
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const existing = await prisma.activity.findFirst({
      where: {
        id,
        type: ActivityType.EVENT,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    const mergedTitle =
      typeof body.title === "string" ? body.title : existing.title;
    const mergedDescription =
      typeof body.description === "string"
        ? body.description
        : existing.description ?? "";
    const shortDesc = computeEventShortDesc({
      title: mergedTitle,
      fullDescriptionHtml: mergedDescription,
    });

    const mergedPlaceId =
      typeof body.placeId === "string"
        ? body.placeId
        : body.venue?.kind === "PLACE" && typeof body.venue?.placeId === "string"
          ? body.venue.placeId
          : undefined;

    let nextBusinessId: string | null | undefined = undefined;
    if (body.businessId !== undefined) {
      nextBusinessId = body.businessId;
    }
    if (typeof mergedPlaceId === "string" && mergedPlaceId.length > 0) {
      const placeRow = await prisma.place.findUnique({
        where: { id: mergedPlaceId },
        select: { ownerBusinessId: true },
      });
      if (!placeRow) {
        return NextResponse.json({ error: "Place not found" }, { status: 404 });
      }
      if (
        body.businessId !== undefined &&
        body.businessId !== null &&
        placeRow.ownerBusinessId != null &&
        body.businessId !== placeRow.ownerBusinessId
      ) {
        return NextResponse.json(
          {
            error:
              "businessId must match the business that owns this place (Place.ownerBusinessId)",
          },
          { status: 400 },
        );
      }
      nextBusinessId = coalesceActivityBusinessIdFromPlace(
        placeRow,
        existing.businessId,
      );
    }

    let nextScheduleJson =
      body.scheduleJson !== undefined
        ? ((body.scheduleJson ?? {}) as Record<string, unknown>)
        : ((existing.scheduleJson ?? {}) as Record<string, unknown>);
    const organizerResolution =
      body.organizerInput && typeof body.organizerInput === "object"
        ? await resolveEventOrganizer(prismaBase, body.organizerInput)
        : {
            organizerId: existing.organizerId ?? null,
            organizerSnapshot:
              nextScheduleJson.organizer && typeof nextScheduleJson.organizer === "object"
                ? (nextScheduleJson.organizer as Record<string, unknown>)
                : null,
          };
    if (body.organizerInput !== undefined) {
      nextScheduleJson = {
        ...nextScheduleJson,
        ...(organizerResolution.organizerSnapshot
          ? { organizer: organizerResolution.organizerSnapshot }
          : {}),
      };
    }
    const nextPrimaryRootCategoryId =
      typeof nextScheduleJson.categoryId === "string" ? nextScheduleJson.categoryId : null;
    const nextPrimaryLeafCategoryId =
      typeof body.eventCategoryId === "string" ? body.eventCategoryId : existing.eventCategoryId;

    assertBusinessEventPrimaryCategory({
      eventCategoryId: nextPrimaryLeafCategoryId,
      scheduleJson: nextScheduleJson,
    });

    const { programCategoryIds } = await validateEventProgramCategories({
      primaryRootCategoryId: nextPrimaryRootCategoryId,
      primaryLeafCategoryId: nextPrimaryLeafCategoryId,
      programCategoryIds: body.programCategoryIds,
    });

    // Update event
    const event = await prisma.activity.update({
      where: {
        id,
      },
      data: {
        title: body.title,
        shortDesc,
        description: body.description,
        ageTags: body.ageTags,
        scheduleMode: body.scheduleMode,
        scheduleJson: nextScheduleJson as Prisma.InputJsonValue,
        // Event category (leaf: subcategory if selected, otherwise root)
        eventCategoryId:
          typeof body.eventCategoryId === "string" ? body.eventCategoryId : undefined,
        programCategoryLinks: {
          deleteMany: {},
          ...(programCategoryIds.length > 0
            ? {
                createMany: {
                  data: programCategoryIds.map((categoryId) => ({ categoryId })),
                  skipDuplicates: true,
                },
              }
            : {}),
        },
        priceFrom: body.priceFrom,
        priceTo: body.priceTo,
        priceText: body.priceText,
        currency: body.currency,
        coverImageId: body.coverImageId,
        organizerId: organizerResolution.organizerId,
        ...(mergedPlaceId !== undefined ? { placeId: mergedPlaceId } : {}),
        ...(nextBusinessId !== undefined ? { businessId: nextBusinessId } : {}),
      },
    });

    // Auto-assign slug only on first meaningful title fill (idempotent).
    if (typeof mergedTitle === "string" && mergedTitle.trim()) {
      await assignActivitySlugIfMissing(event.id, mergedTitle.trim());
    }

    const slugRow = await prisma.activity.findUnique({
      where: { id: event.id },
      select: { slug: true },
    });

    if (body.scheduleJson !== undefined) {
      await replaceActivitySessionsFromScheduleJson(event.id, nextScheduleJson);
    }

    if (body.galleryMediaIds !== undefined) {
      await replaceActivityGalleryFromMediaIds(
        event.id,
        Array.isArray(body.galleryMediaIds)
          ? body.galleryMediaIds.filter((mediaId: unknown): mediaId is string => typeof mediaId === "string")
          : [],
        typeof body.coverImageId === "string" ? body.coverImageId : event.coverImageId,
      );
    }

    if (body.venue !== undefined) {
      await syncEventVenueAndActivityCity(
        event.id,
        body.venue,
        mergedPlaceId,
      );
    } else if (body.placeId !== undefined) {
      await syncEventVenueAndActivityCity(event.id, null, body.placeId);
    }

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
    console.error("Update event error:", error);
    const message = error instanceof Error ? error.message : "Failed to update event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/business/events/[id]
 * Мягкое удаление события (status = DELETED).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await softDeleteActivityById(id);

    revalidatePath("/admin/moderation/events");
    revalidatePath("/admin/content/events");
    revalidatePath("/admin");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Delete event error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

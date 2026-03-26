import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";
import { replaceActivitySessionsFromScheduleJson } from "@/lib/business/syncEventActivitySessions";
import { syncEventVenueAndActivityCity } from "@/lib/business/syncEventVenueFromWizard";
import { computeEventShortDesc } from "@/lib/business/eventShortDesc";
import { softDeleteActivityById } from "@/lib/activity/softDeleteActivity";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";

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
    if (
      !summary ||
      !canManageOwnedContent(user, summary.ownerUserId) ||
      summary.status === "DELETED"
    ) {
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
        scheduleJson: body.scheduleJson,
        // Event category (leaf: subcategory if selected, otherwise root)
        eventCategoryId:
          typeof body.eventCategoryId === "string" ? body.eventCategoryId : undefined,
        priceFrom: body.priceFrom,
        priceTo: body.priceTo,
        priceText: body.priceText,
        currency: body.currency,
        coverImageId: body.coverImageId,
        ...(mergedPlaceId !== undefined ? { placeId: mergedPlaceId } : {}),
        businessId: body.businessId,
      },
    });

    // Auto-assign slug only on first meaningful title fill (idempotent).
    if (typeof mergedTitle === "string" && mergedTitle.trim()) {
      await assignActivitySlugIfMissing(event.id, mergedTitle.trim());
    }

    if (body.scheduleJson !== undefined) {
      await replaceActivitySessionsFromScheduleJson(event.id, body.scheduleJson);
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
    if (
      !summary ||
      !canManageOwnedContent(user, summary.ownerUserId) ||
      summary.status === "DELETED"
    ) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await softDeleteActivityById(id);

    revalidatePath("/admin/moderation/events");
    revalidatePath("/admin");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete event error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete event" },
      { status: 500 }
    );
  }
}

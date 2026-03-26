/**
 * GET /api/business/activities-v2/[id]
 * Get activity details
 * 
 * PATCH /api/business/activities-v2/[id]
 * Update activity (autosave-friendly)
 * 
 * DELETE /api/business/activities-v2/[id]
 * Delete activity
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ActivityType, ScheduleMode, ContentStatus } from "@prisma/client";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";
import { assignActivitySlugIfMissing } from "@/lib/slug/activitySlugService";

/**
 * GET - Get activity details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        place: {
          select: {
            id: true,
            title: true,
            lat: true,
            lng: true,
          },
        },
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Check ownership
    if (!canManageOwnedContent(user, activity.ownerUserId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Get activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update activity (autosave-friendly, lenient validation)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership
    const existing = await prisma.activity.findUnique({
      where: { id },
      select: { ownerUserId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (!canManageOwnedContent(user, existing.ownerUserId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cannot edit PUBLISHED activities (must unpublish first)
    if (existing.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Cannot edit published activity" },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Build update data (only allow specific fields)
    const updateData: any = {};

    // Basic fields
    if (body.title !== undefined) updateData.title = body.title;
    if (body.shortDesc !== undefined) updateData.shortDesc = body.shortDesc;
    if (body.description !== undefined) updateData.description = body.description;

    // Type and schedule
    if (body.type !== undefined) {
      if (!Object.values(ActivityType).includes(body.type)) {
        return NextResponse.json(
          { error: "Invalid activity type" },
          { status: 400 }
        );
      }
      updateData.type = body.type;
    }

    if (body.scheduleMode !== undefined) {
      if (!Object.values(ScheduleMode).includes(body.scheduleMode)) {
        return NextResponse.json(
          { error: "Invalid schedule mode" },
          { status: 400 }
        );
      }
      updateData.scheduleMode = body.scheduleMode;
    }

    if (body.scheduleJson !== undefined) updateData.scheduleJson = body.scheduleJson;
    if (body.nextOccurrenceAt !== undefined) {
      updateData.nextOccurrenceAt = body.nextOccurrenceAt
        ? new Date(body.nextOccurrenceAt)
        : null;
    }

    // Age tags
    if (body.ageTags !== undefined) {
      if (!Array.isArray(body.ageTags)) {
        return NextResponse.json(
          { error: "ageTags must be an array" },
          { status: 400 }
        );
      }
      updateData.ageTags = body.ageTags;
    }

    // Pricing
    if (body.priceFrom !== undefined) updateData.priceFrom = body.priceFrom;
    if (body.priceTo !== undefined) updateData.priceTo = body.priceTo;
    if (body.priceText !== undefined) updateData.priceText = body.priceText;
    if (body.currency !== undefined) updateData.currency = body.currency;

    // Images
    if (body.coverImageId !== undefined) updateData.coverImageId = body.coverImageId;

    // Place
    if (body.placeId !== undefined) {
      if (body.placeId) {
        // Verify place ownership
        const place = await prisma.place.findUnique({
          where: { id: body.placeId },
          select: { ownerUserId: true },
        });

        if (!place) {
          return NextResponse.json({ error: "Place not found" }, { status: 404 });
        }

        if (!canManageOwnedContent(user, place.ownerUserId)) {
          return NextResponse.json(
            { error: "You don't own this place" },
            { status: 403 }
          );
        }
      }
      updateData.placeId = body.placeId;
    }

    // Update activity
    const activity = await prisma.activity.update({
      where: { id },
      data: updateData,
      include: {
        place: {
          select: {
            id: true,
            title: true,
          },
        },
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Auto-assign slug only on first meaningful title fill (idempotent).
    if (body.title !== undefined && typeof body.title === "string" && body.title.trim()) {
      await assignActivitySlugIfMissing(id, body.title.trim());
    }

    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Update activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete activity
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership
    const activity = await prisma.activity.findUnique({
      where: { id },
      select: { ownerUserId: true, status: true },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (!canManageOwnedContent(user, activity.ownerUserId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Cannot delete PUBLISHED activities
    if (activity.status === "PUBLISHED") {
      return NextResponse.json(
        { error: "Cannot delete published activity. Unpublish it first." },
        { status: 400 }
      );
    }

    // Delete activity (cascade will delete images, sessions, etc.)
    await prisma.activity.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

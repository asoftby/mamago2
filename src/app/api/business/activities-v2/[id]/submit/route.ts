/**
 * POST /api/business/activities-v2/[id]/submit
 * Submit Activity for moderation (strict validation)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus, ActivityType } from "@prisma/client";
import { isPlaceRequired } from "@/lib/activity/classification";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManageActivityById } from "@/lib/auth/activityAccess";

interface ValidationError {
  error: "VALIDATION";
  missing: string[];
  fields: Record<string, string>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get activity with images
    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        images: true,
      },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check current status (can only submit from DRAFT, REJECTED, NEEDS_CHANGES)
    if (
      activity.status !== ContentStatus.DRAFT &&
      activity.status !== ContentStatus.REJECTED &&
      activity.status !== ContentStatus.NEEDS_REVISION
    ) {
      return NextResponse.json(
        { error: `Cannot submit from status: ${activity.status}` },
        { status: 400 }
      );
    }

    // Strict validation
    const missing: string[] = [];
    const fields: Record<string, string> = {};

    // Required: title, shortDesc
    if (!activity.title || activity.title.trim().length === 0) {
      missing.push("title");
      fields.title = "Title is required";
    }

    if (!activity.shortDesc || activity.shortDesc.trim().length === 0) {
      missing.push("shortDesc");
      fields.shortDesc = "Short description is required";
    }

    // Required: type
    if (!activity.type) {
      missing.push("type");
      fields.type = "Activity type is required";
    }

    // Required: scheduleMode
    if (!activity.scheduleMode) {
      missing.push("scheduleMode");
      fields.scheduleMode = "Schedule mode is required";
    }

    // Required: placeId (for all types except ROUTE)
    if (activity.type && isPlaceRequired(activity.type)) {
      if (!activity.placeId) {
        missing.push("placeId");
        fields.placeId = "Place is required for this activity type";
      }
    }

    // Required: at least one age tag
    if (!activity.ageTags || activity.ageTags.length === 0) {
      missing.push("ageTags");
      fields.ageTags = "At least one age tag is required";
    }

    // Required: cover image
    if (!activity.coverImageId) {
      missing.push("coverImageId");
      fields.coverImageId = "Cover image is required";
    }

    // Optional: at least 1 gallery photo (recommended but not required)
    const galleryImages = activity.images.filter((img) => img.id !== activity.coverImageId);
    if (galleryImages.length === 0) {
      console.warn(`Activity ${activity.id} has no gallery images`);
    }

    // If validation failed, return errors
    if (missing.length > 0) {
      const response: ValidationError = {
        error: "VALIDATION",
        missing,
        fields,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // All validations passed - update status to PENDING and log moderation
    await prisma.$transaction([
      prisma.activity.update({
        where: { id },
        data: {
          status: ContentStatus.PENDING,
        },
      }),
      prisma.moderationLog.create({
        data: {
          entityType: "ACTIVITY",
          entityId: id,
          action: "SUBMIT",
          message: "Submitted for moderation",
          reviewedByUserId: null,
        },
      }),
    ]);

    // Fetch updated activity
    const updatedActivity = await prisma.activity.findUnique({
      where: { id },
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

    return NextResponse.json({
      success: true,
      activity: updatedActivity,
    });
  } catch (error) {
    console.error("Submit activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

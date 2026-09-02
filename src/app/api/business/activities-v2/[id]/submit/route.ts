/** POST /api/business/activities-v2/[id]/submit */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus } from "@prisma/client";
import { isPlaceRequired } from "@/lib/activity/classification";
import {
  canManageActivityById,
  resolveCanonicalActivityBusinessId,
} from "@/lib/auth/activityAccess";
import {
  checkUserBusinessPermission,
  isPlatformContentStaff,
} from "@/server/permissions/business-permissions";

interface ValidationError {
  error: "VALIDATION";
  missing: string[];
  fields: Record<string, string>;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        images: true,
        place: { select: { ownerBusinessId: true } },
      },
    });
    if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    if (!(await canManageActivityById(user, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isPlatformContentStaff(user.role)) {
      const businessId = resolveCanonicalActivityBusinessId(activity, activity.place);
      if (!businessId) {
        return NextResponse.json({ error: "Business access required" }, { status: 403 });
      }
      if (!(await checkUserBusinessPermission(user, businessId, "content.publish"))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { verificationStatus: true, operationalStatus: true },
      });
      if (
        !business ||
        business.verificationStatus !== "APPROVED" ||
        business.operationalStatus !== "ACTIVE"
      ) {
        return NextResponse.json(
          { error: "Business must be verified and active before submitting publications" },
          { status: 403 },
        );
      }
    }

    if (
      activity.status !== ContentStatus.DRAFT &&
      activity.status !== ContentStatus.REJECTED &&
      activity.status !== ContentStatus.NEEDS_REVISION
    ) {
      return NextResponse.json(
        { error: `Cannot submit from status: ${activity.status}` },
        { status: 400 },
      );
    }

    const missing: string[] = [];
    const fields: Record<string, string> = {};
    if (!activity.title?.trim()) {
      missing.push("title");
      fields.title = "Title is required";
    }
    if (!activity.shortDesc?.trim()) {
      missing.push("shortDesc");
      fields.shortDesc = "Short description is required";
    }
    if (!activity.type) {
      missing.push("type");
      fields.type = "Activity type is required";
    }
    if (!activity.scheduleMode) {
      missing.push("scheduleMode");
      fields.scheduleMode = "Schedule mode is required";
    }
    if (activity.type && isPlaceRequired(activity.type) && !activity.placeId) {
      missing.push("placeId");
      fields.placeId = "Place is required for this activity type";
    }
    if (!activity.coverImageId) {
      missing.push("coverImageId");
      fields.coverImageId = "Cover image is required";
    }

    if (missing.length > 0) {
      const response: ValidationError = { error: "VALIDATION", missing, fields };
      return NextResponse.json(response, { status: 400 });
    }

    await prisma.$transaction([
      prisma.activity.update({
        where: { id },
        data: { status: ContentStatus.PENDING },
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

    const updatedActivity = await prisma.activity.findUnique({
      where: { id },
      include: {
        place: { select: { id: true, title: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ success: true, activity: updatedActivity });
  } catch (error) {
    console.error("Submit activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

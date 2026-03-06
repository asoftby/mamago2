/**
 * POST /api/admin/moderation/places/[id]
 * 
 * Moderate an initial Place submission (approve, needs revision, reject)
 * For post-publication edits, use /api/admin/moderation/revisions/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import {
  approvePlace,
  needsRevisionPlace,
  rejectPlace,
} from "@/server/services/moderation.service";
import {
  notifyPlaceApproved,
  notifyPlaceNeedsChanges,
  notifyPlaceRejected,
} from "@/server/services/notification.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const { action, comment } = await req.json();

    if (!action || !["APPROVE", "NEEDS_REVISION", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE, NEEDS_REVISION, or REJECT" },
        { status: 400 }
      );
    }

    // Get place
    const place = await prisma.place.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        title: true,
        ownerUserId: true,
      },
    });

    if (!place) {
      return NextResponse.json(
        { error: "Place not found" },
        { status: 404 }
      );
    }

    // Validate comment for NEEDS_REVISION and REJECT
    if ((action === "NEEDS_REVISION" || action === "REJECT") && !comment?.trim()) {
      return NextResponse.json(
        { error: "Comment is required for NEEDS_REVISION and REJECT actions" },
        { status: 400 }
      );
    }

    // Call appropriate service function
    try {
      switch (action) {
        case "APPROVE":
          await approvePlace(id, user.id, comment);
          break;
        case "NEEDS_REVISION":
          await needsRevisionPlace(id, user.id, comment);
          break;
        case "REJECT":
          await rejectPlace(id, user.id, comment);
          break;
      }
    } catch (serviceError) {
      // Service layer errors are business logic errors
      return NextResponse.json(
        { error: serviceError instanceof Error ? serviceError.message : "Moderation failed" },
        { status: 400 }
      );
    }

    // Create notification for business owner (outside transaction for resilience)
    try {
      if (action === "APPROVE") {
        await notifyPlaceApproved(id, place.title, place.ownerUserId);
      } else if (action === "NEEDS_REVISION" && comment) {
        await notifyPlaceNeedsChanges(id, place.title, place.ownerUserId, comment);
      } else if (action === "REJECT" && comment) {
        await notifyPlaceRejected(id, place.title, place.ownerUserId, comment);
      }
    } catch (notificationError) {
      // Log but don't fail the request if notification fails
      console.error("Failed to create notification:", notificationError);
    }

    return NextResponse.json({
      success: true,
      action,
    });
  } catch (error) {
    console.error("Moderation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

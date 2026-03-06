/**
 * POST /api/admin/moderation/revisions/[id]
 * 
 * Moderate a PlaceRevision (approve, needs revision, reject)
 * For initial Place submissions, use /api/admin/moderation/places/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import {
  approvePlaceRevision,
  requestPlaceRevisionChanges,
  rejectPlaceRevision,
} from "@/server/services/placeRevision.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: revisionId } = await params;
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

    // Validate comment for NEEDS_REVISION and REJECT
    if ((action === "NEEDS_REVISION" || action === "REJECT") && !comment?.trim()) {
      return NextResponse.json(
        { error: "Comment is required for NEEDS_REVISION and REJECT actions" },
        { status: 400 }
      );
    }

    // Get revision to check it exists and get place info for notifications
    const revision = await prisma.placeRevision.findUnique({
      where: { id: revisionId },
      include: {
        place: {
          select: {
            id: true,
            title: true,
            ownerUserId: true,
          },
        },
      },
    });

    if (!revision) {
      return NextResponse.json(
        { error: "Revision not found" },
        { status: 404 }
      );
    }

    // Call appropriate service function
    try {
      switch (action) {
        case "APPROVE":
          await approvePlaceRevision(revisionId, user.id);
          break;
        case "NEEDS_REVISION":
          await requestPlaceRevisionChanges(revisionId, user.id, comment);
          break;
        case "REJECT":
          await rejectPlaceRevision(revisionId, user.id, comment);
          break;
      }
    } catch (serviceError) {
      // Service layer errors are business logic errors
      return NextResponse.json(
        { error: serviceError instanceof Error ? serviceError.message : "Moderation failed" },
        { status: 400 }
      );
    }

    // TODO: Create notifications for revision actions
    // This will be implemented when notification types are added:
    // - PLACE_UPDATE_APPROVED
    // - PLACE_UPDATE_NEEDS_REVISION
    // - PLACE_UPDATE_REJECTED

    return NextResponse.json({
      success: true,
      action,
    });
  } catch (error) {
    console.error("Revision moderation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

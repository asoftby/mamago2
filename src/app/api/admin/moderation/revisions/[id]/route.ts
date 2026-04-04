/**
 * POST /api/admin/moderation/revisions/[id]
 *
 * Moderate a PlaceRevision (approve, needs revision, reject).
 * Notifications are sent inside placeRevision.service.ts — not here.
 * For initial Place submissions use /api/admin/moderation/places/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  approvePlaceRevision,
  requestPlaceRevisionChanges,
  rejectPlaceRevision,
} from "@/server/services/placeRevision.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: revisionId } = await params;
    const user = await getCurrentUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { action, comment } = await req.json();

    if (!action || !["APPROVE", "NEEDS_REVISION", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE, NEEDS_REVISION, or REJECT" },
        { status: 400 },
      );
    }

    if ((action === "NEEDS_REVISION" || action === "REJECT") && !comment?.trim()) {
      return NextResponse.json(
        { error: "Comment is required for NEEDS_REVISION and REJECT actions" },
        { status: 400 },
      );
    }

    try {
      switch (action) {
        case "APPROVE":        await approvePlaceRevision(revisionId, user.id); break;
        case "NEEDS_REVISION": await requestPlaceRevisionChanges(revisionId, user.id, comment); break;
        case "REJECT":         await rejectPlaceRevision(revisionId, user.id, comment); break;
      }
    } catch (serviceError) {
      return NextResponse.json(
        { error: serviceError instanceof Error ? serviceError.message : "Moderation failed" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Revision moderation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

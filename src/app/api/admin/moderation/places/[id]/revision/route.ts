/**
 * API endpoint for moderating Place revisions
 * POST /api/admin/moderation/places/[id]/revision
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
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { revisionId, action, comment } = await req.json();

    if (!revisionId) {
      return NextResponse.json(
        { error: "revisionId is required" },
        { status: 400 }
      );
    }

    if (!action || !["APPROVE", "NEEDS_REVISION", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Execute moderation action
    switch (action) {
      case "APPROVE":
        await approvePlaceRevision(revisionId, user.id);
        break;

      case "NEEDS_REVISION":
        if (!comment) {
          return NextResponse.json(
            { error: "Comment is required for NEEDS_REVISION" },
            { status: 400 }
          );
        }
        await requestPlaceRevisionChanges(revisionId, user.id, comment);
        break;

      case "REJECT":
        if (!comment) {
          return NextResponse.json(
            { error: "Comment is required for REJECT" },
            { status: 400 }
          );
        }
        await rejectPlaceRevision(revisionId, user.id, comment);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Place revision moderation error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

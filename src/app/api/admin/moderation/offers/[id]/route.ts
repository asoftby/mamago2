/**
 * POST /api/admin/moderation/offers/[id]
 *
 * Moderate an Offer submission (approve, needs_revision, reject).
 * Notifications are sent inside the service layer.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  approveOffer,
  needsRevisionOffer,
  rejectOffer,
} from "@/server/services/moderation.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
        case "APPROVE":        await approveOffer(id, user.id); break;
        case "NEEDS_REVISION": await needsRevisionOffer(id, user.id, comment); break;
        case "REJECT":         await rejectOffer(id, user.id, comment); break;
      }
    } catch (serviceError) {
      return NextResponse.json(
        { error: serviceError instanceof Error ? serviceError.message : "Moderation failed" },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Offer moderation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

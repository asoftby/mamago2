/**
 * POST /api/admin/moderation/events/[id]  — moderate activity (approve / needs_revision / reject)
 * DELETE /api/admin/moderation/events/[id] — soft-delete event from moderation queue
 *
 * Notifications are sent inside the service layer.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import { softDeleteActivityById } from "@/lib/activity/softDeleteActivity";
import { fetchActivityEventRowSummary } from "@/lib/activity/fetchActivityEventRowSummary";
import {
  approveActivity,
  needsRevisionActivity,
  rejectActivity,
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
        case "APPROVE":        await approveActivity(id, user.id, comment); break;
        case "NEEDS_REVISION": await needsRevisionActivity(id, user.id, comment); break;
        case "REJECT":         await rejectActivity(id, user.id, comment); break;
      }
    } catch (serviceError) {
      return NextResponse.json(
        { error: serviceError instanceof Error ? serviceError.message : "Moderation failed" },
        { status: 400 },
      );
    }

    revalidatePath("/admin/moderation/events");
    revalidatePath("/admin/content/events");
    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error("Activity moderation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const summary = await fetchActivityEventRowSummary(id);
    if (!summary || summary.status === "DELETED") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await softDeleteActivityById(id);
    revalidatePath("/admin/moderation/events");
    revalidatePath("/admin/content/events");
    revalidatePath("/admin");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[admin] Delete moderation event error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

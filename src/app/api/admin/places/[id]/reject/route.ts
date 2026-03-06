import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { rejectPlace } from "@/server/services/moderation.service";

/**
 * POST /api/admin/places/[id]/reject
 * Reject a Place (PENDING → REJECTED)
 * Admin/Moderator only
 * Message is required
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: placeId } = await params;
    const body = await req.json();
    const { message } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    await rejectPlace(placeId, user.id, message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting place:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reject place" },
      { status: 400 }
    );
  }
}

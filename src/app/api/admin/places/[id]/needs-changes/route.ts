import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { needsRevisionPlace } from "@/server/services/moderation.service";

/**
 * POST /api/admin/places/[id]/needs-changes
 * Request changes for a Place (PENDING → NEEDS_CHANGES)
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

    await needsRevisionPlace(placeId, user.id, message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error requesting changes for place:", error);
    return NextResponse.json(
      { error: "Failed to request changes" },
      { status: 400 }
    );
  }
}

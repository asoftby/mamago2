import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { approvePlace } from "@/server/services/moderation.service";
import { createPublishTimer } from "@/server/utils/publishPipeline";

/**
 * POST /api/admin/places/[id]/approve
 * Approve a Place (PENDING → PUBLISHED)
 * Admin/Moderator only
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const timer = createPublishTimer("publish:place");
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
    const { note } = body;

    await approvePlace(placeId, user.id, note);
    timer.mark("status");
    timer.log({ flow: "admin-approve" });

    return NextResponse.json({ success: true });
  } catch (error) {
    timer.log({ error: 1 });
    console.error("Error approving place:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to approve place" },
      { status: 400 }
    );
  }
}

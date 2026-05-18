/**
 * POST /api/admin/places/claims/[id]/reject - Reject claim request
 * Admin only
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { rejectPlaceClaim } from "@/server/services/placeClaim.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: claimId } = await params;
    const body = await request.json();
    const { note } = body;

    if (!note?.trim()) {
      return NextResponse.json(
        { error: "Rejection note is required" },
        { status: 400 }
      );
    }

    await rejectPlaceClaim(claimId, user.id, note);

    return NextResponse.json({ 
      success: true,
      message: "Claim rejected successfully"
    });
  } catch (error) {
    console.error("[admin/claims/reject] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to reject claim"
      },
      { status: 400 }
    );
  }
}

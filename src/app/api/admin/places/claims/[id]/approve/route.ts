/**
 * POST /api/admin/places/claims/[id]/approve - Approve claim request
 * Admin only
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { approvePlaceClaim } from "@/server/services/placeClaim.service";

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

    await approvePlaceClaim(claimId, user.id, note);

    return NextResponse.json({ 
      success: true,
      message: "Claim approved successfully"
    });
  } catch (error) {
    console.error("[admin/claims/approve] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to approve claim"
      },
      { status: 400 }
    );
  }
}

/**
 * POST /api/admin/places/[id]/assign-owner - Manually assign business owner
 * Admin only
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { manuallyAssignPlaceOwner } from "@/server/services/placeClaim.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await params;
    const body = await request.json();
    const { businessId } = body;

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required" },
        { status: 400 }
      );
    }

    await manuallyAssignPlaceOwner(placeId, businessId, user.id);

    return NextResponse.json({ 
      success: true,
      message: "Business owner assigned successfully"
    });
  } catch (error) {
    console.error("[admin/assign-owner] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to assign owner"
      },
      { status: 400 }
    );
  }
}

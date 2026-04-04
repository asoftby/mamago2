/**
 * GET /api/admin/places/claims - List pending claim requests
 * Admin only
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getPendingClaimRequests } from "@/server/services/placeClaim.service";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = await getPendingClaimRequests();

    return NextResponse.json({ claims });
  } catch (error) {
    console.error("[admin/claims] List error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

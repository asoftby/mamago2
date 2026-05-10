import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { recomputeAllMediaUsageCounts } from "@/server/services/media/media-usage.service";

/**
 * POST /api/admin/media/recompute-usage
 * 
 * Admin-only endpoint to recompute all media usage counts.
 * Safe operation: no deletions, no URL changes, only MediaUsage sync.
 * 
 * Returns:
 * - totalMediaAssets: total number of media assets
 * - zeroUsageCount: number of media with 0 usage
 * - durationMs: time taken to recompute
 * - stats: breakdown by entity type
 */
export async function POST() {
  try {
    // Check authentication and admin role
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // Run recompute
    const result = await recomputeAllMediaUsageCounts();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error recomputing media usage:", error);
    return NextResponse.json(
      { 
        error: "Failed to recompute media usage",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

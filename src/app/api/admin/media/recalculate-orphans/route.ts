/**
 * Admin Media API - Recalculate all orphans endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { recalculateAllOrphanedStatuses } from "@/server/services/media/media.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await recalculateAllOrphanedStatuses();

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error recalculating orphans:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to recalculate orphans" },
      { status: 500 }
    );
  }
}

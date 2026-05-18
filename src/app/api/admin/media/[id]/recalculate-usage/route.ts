/**
 * Admin Media API - Recalculate usage endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { recalculateMediaUsageStatus } from "@/server/services/media/media.service";
import { recomputeMediaUsageForAsset } from "@/server/services/media/media-usage.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const recompute = await recomputeMediaUsageForAsset(id);
    const media = await recalculateMediaUsageStatus(id);

    return NextResponse.json({
      success: true,
      media,
      recompute,
    });
  } catch (error: unknown) {
    console.error("Error recalculating media usage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

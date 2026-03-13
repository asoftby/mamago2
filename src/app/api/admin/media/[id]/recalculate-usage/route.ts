/**
 * Admin Media API - Recalculate usage endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { recalculateMediaUsageStatus } from "@/server/services/media/media.service";

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
    const media = await recalculateMediaUsageStatus(id);

    return NextResponse.json(media);
  } catch (error: any) {
    console.error("Error recalculating media usage:", error);
    return NextResponse.json(
      { error: error.message || "Failed to recalculate usage" },
      { status: 500 }
    );
  }
}

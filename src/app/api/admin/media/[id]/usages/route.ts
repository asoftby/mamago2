/**
 * Admin Media API - Usages endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMediaUsagesWithDetails } from "@/server/services/media/media-usage.service";

export async function GET(
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
    const usages = await getMediaUsagesWithDetails(id);

    return NextResponse.json({ usages });
  } catch (error: any) {
    console.error("Error fetching media usages:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch usages" },
      { status: 500 }
    );
  }
}

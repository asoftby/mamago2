/**
 * POST /api/business/temp-media/reorder
 * Reorder temp media items (for gallery sorting)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { wizardSessionId, orderedMediaIds } = body;

    if (!wizardSessionId || !Array.isArray(orderedMediaIds)) {
      return NextResponse.json(
        { error: "wizardSessionId and orderedMediaIds array are required" },
        { status: 400 }
      );
    }

    // Update sort order for each media item
    await Promise.all(
      orderedMediaIds.map((mediaId, index) =>
        prisma.tempMedia.updateMany({
          where: {
            id: mediaId,
            ownerUserId: user.id,
            wizardSessionId,
            status: "TEMP",
          },
          data: {
            sortOrder: index,
          },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reorder temp media error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Archive/Unarchive Place API
 * POST /api/business/places/[id]/archive - Archive place
 * DELETE /api/business/places/[id]/archive - Unarchive place
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { archivePlace, unarchivePlace } from "@/server/services/placeArchive.service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await context.params;

    const place = await archivePlace(placeId, user.id);

    return NextResponse.json({
      success: true,
      place: {
        id: place.id,
        archivedAt: place.archivedAt,
      },
    });
  } catch (error) {
    console.error("Archive place error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive place" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await context.params;

    const place = await unarchivePlace(placeId, user.id);

    return NextResponse.json({
      success: true,
      place: {
        id: place.id,
        archivedAt: place.archivedAt,
      },
    });
  } catch (error) {
    console.error("Unarchive place error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unarchive place" },
      { status: 400 }
    );
  }
}

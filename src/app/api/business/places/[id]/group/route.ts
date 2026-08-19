import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import {
  PlaceGroupValidationError,
  syncManualPlaceGroup,
} from "@/server/services/placeGroups/manualPlaceGroups";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await params;
    const body = await request.json();
    const { relatedPlaceIds } = body as { relatedPlaceIds?: string[] };

    // Fetch current place
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        id: true,
        createdByUserId: true,
        ownerBusinessId: true,
        placeGroupId: true,
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Verify access using business-based ownership
    const canManage = await canManagePlaceAsync(user, place);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!place.ownerBusinessId) {
      return NextResponse.json(
        { error: "Only business-owned places can be linked in business flow" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      return syncManualPlaceGroup({
        tx,
        place,
        relatedPlaceIds: Array.isArray(relatedPlaceIds) ? relatedPlaceIds : [],
        sameBusinessOnly: true,
      });
    });

    return NextResponse.json({ success: true, placeGroupId: result.placeGroupId });
  } catch (error) {
    if (error instanceof PlaceGroupValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to update place group:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

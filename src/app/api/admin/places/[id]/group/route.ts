import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import {
  PlaceGroupValidationError,
  syncManualPlaceGroup,
} from "@/server/services/placeGroups/manualPlaceGroups";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: placeId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      relatedPlaceIds?: string[];
    };

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

    const result = await prisma.$transaction(async (tx) =>
      syncManualPlaceGroup({
        tx,
        place,
        relatedPlaceIds: Array.isArray(body.relatedPlaceIds)
          ? body.relatedPlaceIds
          : [],
      }),
    );

    return NextResponse.json({
      success: true,
      placeGroupId: result.placeGroupId,
    });
  } catch (error) {
    if (error instanceof PlaceGroupValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[admin-place-group] Failed to update place group:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

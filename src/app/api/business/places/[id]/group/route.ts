import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { canManageOwnedContent } from "@/lib/auth/businessContentAccess";

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
    const { relatedPlaceIds } = body as { relatedPlaceIds: string[] };

    // Fetch current place
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: {
        id: true,
        ownerUserId: true,
        placeGroupId: true,
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Verify ownership (владелец или админ/модератор)
    if (!canManageOwnedContent(user, place.ownerUserId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If no related places, remove from group
    if (!relatedPlaceIds || relatedPlaceIds.length === 0) {
      if (place.placeGroupId) {
        await prisma.place.update({
          where: { id: placeId },
          data: { placeGroupId: null },
        });

        // Check if group is now empty and delete it
        const groupPlacesCount = await prisma.place.count({
          where: { placeGroupId: place.placeGroupId },
        });

        if (groupPlacesCount === 0) {
          await prisma.placeGroup.delete({
            where: { id: place.placeGroupId },
          });
        }
      }

      return NextResponse.json({ success: true, placeGroupId: null });
    }

    // Fetch related places to check their groups
    const relatedPlaces = await prisma.place.findMany({
      where: {
        id: { in: relatedPlaceIds },
        ownerUserId: place.ownerUserId, // Security: only same owner
      },
      select: {
        id: true,
        placeGroupId: true,
      },
    });

    // Check if related places belong to different groups
    const existingGroupIds = new Set(
      relatedPlaces
        .map((p) => p.placeGroupId)
        .filter((id): id is string => id !== null)
    );

    if (existingGroupIds.size > 1) {
      return NextResponse.json(
        { error: "Selected places belong to different groups" },
        { status: 400 }
      );
    }

    let groupId: string;

    if (existingGroupIds.size === 1) {
      // Add to existing group
      groupId = Array.from(existingGroupIds)[0];
    } else {
      // Create new group
      const newGroup = await prisma.placeGroup.create({
        data: {
          ownerUserId: place.ownerUserId,
        },
      });
      groupId = newGroup.id;

      // Add related places to new group
      await prisma.place.updateMany({
        where: {
          id: { in: relatedPlaceIds },
        },
        data: {
          placeGroupId: groupId,
        },
      });
    }

    // Add current place to group
    await prisma.place.update({
      where: { id: placeId },
      data: { placeGroupId: groupId },
    });

    return NextResponse.json({ success: true, placeGroupId: groupId });
  } catch (error) {
    console.error("Failed to update place group:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

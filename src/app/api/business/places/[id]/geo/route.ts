/**
 * PATCH /api/business/places/[id]/geo
 * Update district/metro manual overrides
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { calculateMetroDistance } from "@/services/geo/geoEnrichment.service";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership and get place coordinates
    const existing = await prisma.place.findUnique({
      where: { id },
      select: {
        createdByUserId: true,
        ownerBusinessId: true,
        lat: true,
        lng: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const canManage = await canManagePlaceAsync(user, existing);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updateData: Prisma.PlaceUpdateInput = {};

    // Handle district manual override
    if (body.districtManualId !== undefined) {
      updateData.districtManual = body.districtManualId
        ? { connect: { id: body.districtManualId } }
        : { disconnect: true };
    }

    // Handle metro manual override
    if (body.metroManualId !== undefined) {
      updateData.metroManual = body.metroManualId
        ? { connect: { id: body.metroManualId } }
        : { disconnect: true };

      // Calculate distance to manually selected metro
      if (body.metroManualId && existing.lat && existing.lng) {
        const distance = await calculateMetroDistance(
          existing.lat,
          existing.lng,
          body.metroManualId
        );
        updateData.metroManualDistanceM = distance;
      } else {
        // Clear distance if metro is cleared
        updateData.metroManualDistanceM = null;
      }
    }

    const place = await prisma.place.update({
      where: { id },
      data: updateData,
      include: {
        districtAuto: true,
        districtManual: true,
        metroAuto: true,
        metroManual: true,
      },
    });

    return NextResponse.json({ place });
  } catch (error) {
    console.error("Update geo data error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

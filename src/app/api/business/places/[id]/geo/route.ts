/** PATCH /api/business/places/[id]/geo */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { calculateMetroDistance } from "@/services/geo/geoEnrichment.service";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.place.findUnique({
      where: { id },
      select: { createdByUserId: true, ownerBusinessId: true, lat: true, lng: true },
    });
    if (!existing) return NextResponse.json({ error: "Place not found" }, { status: 404 });
    if (!(await canManagePlaceAsync(user, existing))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updateData: Prisma.PlaceUpdateInput = {};
    if (body.districtManualId !== undefined) {
      updateData.districtManual = body.districtManualId
        ? { connect: { id: body.districtManualId } }
        : { disconnect: true };
    }

    if (body.metroManualId !== undefined) {
      updateData.metroManual = body.metroManualId
        ? { connect: { id: body.metroManualId } }
        : { disconnect: true };
      updateData.metroManualDistanceM =
        body.metroManualId && existing.lat && existing.lng
          ? await calculateMetroDistance(existing.lat, existing.lng, body.metroManualId)
          : null;
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

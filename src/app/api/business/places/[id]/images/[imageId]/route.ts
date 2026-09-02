/** DELETE /api/business/places/[id]/images/[imageId] */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { id: placeId, imageId } = await params;
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { ownerBusinessId: true, logoImageId: true, createdByUserId: true },
    });
    if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });
    if (!(await canManagePlaceAsync(user, place))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const image = await prisma.placeImage.findUnique({
      where: { id: imageId },
      select: { placeId: true, kind: true },
    });
    if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });
    if (image.placeId !== placeId) {
      return NextResponse.json(
        { error: "Image does not belong to this place" },
        { status: 403 },
      );
    }

    if (image.kind === "LOGO" && place.logoImageId === imageId) {
      await prisma.place.update({ where: { id: placeId }, data: { logoImageId: null } });
    }
    await prisma.placeImage.delete({ where: { id: imageId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete place image error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

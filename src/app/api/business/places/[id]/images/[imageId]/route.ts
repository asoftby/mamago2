/**
 * DELETE /api/business/places/[id]/images/[imageId]
 * Remove image from place
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId, imageId } = await params;

    // Check ownership
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { ownerUserId: true, logoImageId: true },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    if (!canManageOwnedContent(user, place.ownerUserId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if image exists and belongs to this place
    const image = await prisma.placeImage.findUnique({
      where: { id: imageId },
      select: { placeId: true, kind: true },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    if (image.placeId !== placeId) {
      return NextResponse.json(
        { error: "Image does not belong to this place" },
        { status: 403 }
      );
    }

    // If this is the logo, clear place.logoImageId
    if (image.kind === "LOGO" && place.logoImageId === imageId) {
      await prisma.place.update({
        where: { id: placeId },
        data: { logoImageId: null },
      });
    }

    // Delete image
    await prisma.placeImage.delete({
      where: { id: imageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete place image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

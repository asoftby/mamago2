/**
 * POST /api/business/places/[id]/images
 * Add image to place (logo or gallery)
 * 
 * DELETE /api/business/places/[id]/images/[imageId]
 * Remove image from place
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { PlaceImageKind } from "@prisma/client";

/**
 * POST - Add image to place
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await params;

    // Check ownership
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { ownerUserId: true },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    if (place.ownerUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { url, width, height, blurhash, kind, sortOrder } = body;

    // Validate required fields
    if (!url || !kind) {
      return NextResponse.json(
        { error: "url and kind are required" },
        { status: 400 }
      );
    }

    // Validate kind
    if (!Object.values(PlaceImageKind).includes(kind)) {
      return NextResponse.json(
        { error: "Invalid kind. Must be LOGO or GALLERY" },
        { status: 400 }
      );
    }

    // If kind is LOGO, remove existing logo
    if (kind === "LOGO") {
      await prisma.placeImage.deleteMany({
        where: {
          placeId,
          kind: "LOGO",
        },
      });
    }

    // Get next sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const lastImage = await prisma.placeImage.findFirst({
        where: { placeId, kind },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      finalSortOrder = (lastImage?.sortOrder || 0) + 1;
    }

    // Create image
    const image = await prisma.placeImage.create({
      data: {
        placeId,
        kind,
        url,
        width: width || null,
        height: height || null,
        blurhash: blurhash || null,
        sortOrder: finalSortOrder,
      },
    });

    // If LOGO, update place.logoImageId
    if (kind === "LOGO") {
      await prisma.place.update({
        where: { id: placeId },
        data: { logoImageId: image.id },
      });
    }

    // Return image and updated images list for wizard state sync
    const allImages = await prisma.placeImage.findMany({
      where: { placeId },
      orderBy: [
        { kind: "asc" }, // LOGO first, then GALLERY
        { sortOrder: "asc" },
      ],
    });

    return NextResponse.json({ image, images: allImages });
  } catch (error) {
    console.error("Add place image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

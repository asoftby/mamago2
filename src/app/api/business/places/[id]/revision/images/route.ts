/**
 * POST /api/business/places/[id]/revision/images
 * Add image to place revision (logo or gallery)
 * 
 * For published places, images must be added to PlaceRevision, not Place directly
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { PlaceImageKind } from "@prisma/client";
import { getOrCreatePlaceRevision } from "@/server/services/placeRevision.service";

import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

/**
 * POST - Add image to place revision
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await params;

    // Check ownership
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { 
        createdByUserId: true,
        ownerBusinessId: true,
        status: true,
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const canManage = await canManagePlaceAsync(user, place);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only for published places
    if (place.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "This endpoint is only for published places. Use /api/business/places/[id]/images for draft places." },
        { status: 400 }
      );
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

    // Get or create revision
    const revision = await getOrCreatePlaceRevision(placeId, user);

    // If kind is LOGO, remove existing logo from revision
    if (kind === "LOGO") {
      await prisma.placeRevisionImage.deleteMany({
        where: {
          revisionId: revision.id,
          kind: "LOGO",
        },
      });
    }

    // Get next sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const lastImage = await prisma.placeRevisionImage.findFirst({
        where: { revisionId: revision.id, kind },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      finalSortOrder = (lastImage?.sortOrder || 0) + 1;
    }

    // Create image in revision
    const image = await prisma.placeRevisionImage.create({
      data: {
        revisionId: revision.id,
        kind,
        url,
        width: width || null,
        height: height || null,
        blurhash: blurhash || null,
        sortOrder: finalSortOrder,
      },
    });

    // If LOGO, update revision.logoImageId
    if (kind === "LOGO") {
      await prisma.placeRevision.update({
        where: { id: revision.id },
        data: { logoImageId: image.id },
      });
    }

    // Return image and updated images list for wizard state sync
    const allImages = await prisma.placeRevisionImage.findMany({
      where: { revisionId: revision.id },
      orderBy: [
        { kind: "asc" }, // LOGO first, then GALLERY
        { sortOrder: "asc" },
      ],
    });

    return NextResponse.json({ 
      image, 
      images: allImages,
      revisionId: revision.id,
    });
  } catch (error) {
    console.error("Add place revision image error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove image from place revision
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: placeId } = await params;
    const { searchParams } = new URL(req.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { error: "imageId query parameter is required" },
        { status: 400 }
      );
    }

    // Check ownership
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { 
        createdByUserId: true,
        ownerBusinessId: true,
        status: true,
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const canManage = await canManagePlaceAsync(user, place);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only for published places
    if (place.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "This endpoint is only for published places" },
        { status: 400 }
      );
    }

    // Get revision
    const revision = await getOrCreatePlaceRevision(placeId, user);

    // Check if image belongs to this revision
    const image = await prisma.placeRevisionImage.findUnique({
      where: { id: imageId },
      select: { revisionId: true, kind: true },
    });

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    if (image.revisionId !== revision.id) {
      return NextResponse.json({ error: "Image does not belong to this revision" }, { status: 403 });
    }

    // Delete image
    await prisma.placeRevisionImage.delete({
      where: { id: imageId },
    });

    // If was LOGO, clear revision.logoImageId
    if (image.kind === "LOGO") {
      await prisma.placeRevision.update({
        where: { id: revision.id },
        data: { logoImageId: null },
      });
    }

    // Return updated images list
    const allImages = await prisma.placeRevisionImage.findMany({
      where: { revisionId: revision.id },
      orderBy: [
        { kind: "asc" },
        { sortOrder: "asc" },
      ],
    });

    return NextResponse.json({ images: allImages });
  } catch (error) {
    console.error("Delete place revision image error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

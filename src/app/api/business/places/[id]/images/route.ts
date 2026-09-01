/** POST /api/business/places/[id]/images */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { PlaceImageKind, MediaEntityType } from "@prisma/client";
import { attachMediaToEntity } from "@/lib/media/mediaRegistry";
import { ensureMediaAssetForStoredFileUrl } from "@/lib/media/ensureMediaAssetForStoredFileUrl";
import { extractMediaRelativePathFromUrl } from "@/server/media/media-storage";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { id: placeId } = await params;
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { createdByUserId: true, ownerBusinessId: true },
    });
    if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });
    if (!(await canManagePlaceAsync(user, place))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { url, width, height, blurhash, kind, sortOrder } = body;
    if (!url || !kind) {
      return NextResponse.json({ error: "url and kind are required" }, { status: 400 });
    }
    if (!Object.values(PlaceImageKind).includes(kind)) {
      return NextResponse.json(
        { error: "Invalid kind. Must be LOGO or GALLERY" },
        { status: 400 },
      );
    }

    if (kind === "LOGO") {
      await prisma.placeImage.deleteMany({ where: { placeId, kind: "LOGO" } });
    }

    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const lastImage = await prisma.placeImage.findFirst({
        where: { placeId, kind },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      finalSortOrder = (lastImage?.sortOrder || 0) + 1;
    }

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

    try {
      let mediaAsset = await prisma.mediaAsset.findFirst({
        where: { OR: [{ storageKey: url }, { publicUrl: url }] },
      });
      if (!mediaAsset && typeof url === "string" && extractMediaRelativePathFromUrl(url)) {
        mediaAsset = await ensureMediaAssetForStoredFileUrl({
          publicUrl: url,
          uploadedById: user.id,
          userRole: user.role,
          width: width ?? null,
          height: height ?? null,
          originalName: kind === "LOGO" ? "place-logo.webp" : "place-gallery.webp",
        });
      }
      if (mediaAsset) {
        await attachMediaToEntity({
          mediaId: mediaAsset.id,
          entityType: MediaEntityType.PLACE,
          entityId: placeId,
          field: kind === "LOGO" ? "logo" : "gallery",
        });
      }
    } catch (mediaError) {
      console.error("Failed to register media usage:", mediaError);
    }

    if (kind === "LOGO") {
      await prisma.place.update({ where: { id: placeId }, data: { logoImageId: image.id } });
    }

    const allImages = await prisma.placeImage.findMany({
      where: { placeId },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ image, images: allImages });
  } catch (error) {
    console.error("Add place image error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

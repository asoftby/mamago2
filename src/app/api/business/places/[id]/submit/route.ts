/**
 * POST /api/business/places/[id]/submit
 * Submit Place for moderation (strict validation)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus, MediaEntityType, PlaceKind } from "@prisma/client";
import { publishPlaceFromDraft, submitPlace } from "@/server/services/moderation.service";
import {
  canCreateBusinessContent,
  canPublishContentDirectly,
} from "@/lib/auth/businessContentAccess";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import { isMediaAssetCuid } from "@/lib/media/isMediaAssetCuid";
import { createPublishTimer } from "@/server/utils/publishPipeline";
import { attachMediaToEntity } from "@/lib/media/mediaRegistry";
import { ensureMediaAssetForStoredFileUrl } from "@/lib/media/ensureMediaAssetForStoredFileUrl";
import { extractMediaRelativePathFromUrl } from "@/server/media/media-storage";

interface ValidationError {
  error: "VALIDATION";
  missing: string[];
  fields: Record<string, string>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const timer = createPublishTimer("publish:place");
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get only fields needed for publish validation. Opening hours are not required
    // and should not slow down the publish button.
    const place = await prisma.place.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        category: true,
        shortDesc: true,
        logoImageId: true,
        lat: true,
        lng: true,
        locationSource: true,
        placeKind: true,
        parentPlaceId: true,
        floor: true,
        unit: true,
        status: true,
        createdByUserId: true,
        ownerBusinessId: true,
        archivedAt: true,
        slug: true,
        images: {
          select: {
            id: true,
            kind: true,
          },
        },
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Check access using business-based ownership
    const canManage = await canManagePlaceAsync(user, place);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check current status (can only submit from DRAFT, REJECTED, NEEDS_REVISION)
    if (
      place.status !== ContentStatus.DRAFT &&
      place.status !== ContentStatus.REJECTED &&
      place.status !== ContentStatus.NEEDS_REVISION
    ) {
      return NextResponse.json(
        { error: `Cannot submit from status: ${place.status}` },
        { status: 400 }
      );
    }
    timer.mark("db");

    // Convert TempMedia → PlaceImage if wizardSessionId provided (edit mode with pending uploads)
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const wizardSessionId = typeof body.wizardSessionId === "string" ? body.wizardSessionId : null;
    if (wizardSessionId) {
      try {
        const tempMediaItems = await prisma.tempMedia.findMany({
          where: { ownerUserId: user.id, wizardSessionId, status: "TEMP" },
          orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
        });
        if (tempMediaItems.length > 0) {
          const createdImages = await Promise.all(
            tempMediaItems.map(async (media) => {
              const kind = media.kind === "PLACE_LOGO" ? "LOGO" : "GALLERY";
              const placeImage = await prisma.placeImage.create({
                data: { placeId: id, kind, url: media.url, width: media.width, height: media.height, blurhash: media.blurhash, sortOrder: media.sortOrder },
              });
              try {
                let mediaAsset = await prisma.mediaAsset.findFirst({ where: { OR: [{ storageKey: media.url }, { publicUrl: media.url }] } });
                if (!mediaAsset && typeof media.url === "string" && extractMediaRelativePathFromUrl(media.url)) {
                  mediaAsset = await ensureMediaAssetForStoredFileUrl({ publicUrl: media.url, uploadedById: user.id, userRole: user.role, width: media.width, height: media.height, originalName: kind === "LOGO" ? "place-logo.webp" : "place-gallery.webp" });
                }
                if (mediaAsset) {
                  await attachMediaToEntity({ mediaId: mediaAsset.id, entityType: MediaEntityType.PLACE, entityId: id, field: kind === "LOGO" ? "logo" : "gallery" });
                }
              } catch { /* non-fatal */ }
              return placeImage;
            })
          );
          const logoPlaceImage = createdImages.find((img) => img.kind === "LOGO");
          if (logoPlaceImage) {
            await prisma.place.update({ where: { id }, data: { logoImageId: logoPlaceImage.id } });
          }
          await prisma.tempMedia.updateMany({ where: { ownerUserId: user.id, wizardSessionId, status: "TEMP" }, data: { status: "ATTACHED", placeId: id } });
        }
      } catch (e) {
        console.error("[submit] Failed to attach temp media:", e);
      }
      // Refresh place data after TempMedia conversion
      const refreshed = await prisma.place.findUnique({ where: { id }, select: { logoImageId: true, images: { select: { id: true, kind: true } } } });
      if (refreshed) {
        (place as { logoImageId: string | null }).logoImageId = refreshed.logoImageId;
        (place as { images: { id: string; kind: string }[] }).images = refreshed.images;
      }
    }
    // Strict validation
    const missing: string[] = [];
    const fields: Record<string, string> = {};

    // Required: title, category, shortDesc
    if (!place.title || place.title.trim().length === 0) {
      missing.push("title");
      fields.title = "Title is required";
    }

    if (!place.category || place.category.trim().length === 0) {
      missing.push("category");
      fields.category = "Category is required";
    }

    if (!place.shortDesc || place.shortDesc.trim().length === 0) {
      missing.push("shortDesc");
      fields.shortDesc = "Short description is required";
    }

    // Required: logoImageId (must have LOGO image)
    const logoImage = place.images.find((img) => img.kind === "LOGO");
    const logoFromMediaLibrary =
      !logoImage && place.logoImageId && isMediaAssetCuid(place.logoImageId)
        ? await prisma.mediaAsset.findFirst({
            where: {
              id: place.logoImageId,
              status: "ACTIVE",
            },
            select: {
              id: true,
              publicUrl: true,
              width: true,
              height: true,
            },
          })
        : null;
    if (!logoImage && !logoFromMediaLibrary) {
      missing.push("logoImageId");
      fields.logoImageId = "Logo image is required";
    }

    // Required: location (lat/lng + locationSource)
    if (place.lat === null || place.lng === null) {
      missing.push("location");
      fields.location = "Location coordinates are required";
    }

    if (!place.locationSource) {
      missing.push("locationSource");
      fields.locationSource = "Location source is required";
    }

    // For UNIT: require parentPlaceId, floor, unit
    if (place.placeKind === PlaceKind.UNIT) {
      if (!place.parentPlaceId) {
        missing.push("parentPlaceId");
        fields.parentPlaceId = "Parent place is required for UNIT";
      }

      if (!place.floor || place.floor.trim().length === 0) {
        missing.push("floor");
        fields.floor = "Floor is required for UNIT";
      }

      if (!place.unit || place.unit.trim().length === 0) {
        missing.push("unit");
        fields.unit = "Unit number is required for UNIT";
      }
    }

    // Optional: at least 1 gallery photo (recommended but not required)
    const galleryImages = place.images.filter((img) => img.kind === "GALLERY");
    if (galleryImages.length === 0) {
      // Warning, not error
      console.warn(`Place ${place.id} has no gallery images`);
    }

    // If validation failed, return errors
    if (missing.length > 0) {
      const response: ValidationError = {
        error: "VALIDATION",
        missing,
        fields,
      };
      return NextResponse.json(response, { status: 400 });
    }
    timer.mark("validate");

    if (logoImage && !place.logoImageId) {
      await prisma.place.update({
        where: { id: place.id },
        data: { logoImageId: logoImage.id },
      });
    }

    if (!logoImage && logoFromMediaLibrary?.publicUrl?.trim()) {
      const image = await prisma.placeImage.create({
        data: {
          placeId: place.id,
          kind: "LOGO",
          url: logoFromMediaLibrary.publicUrl,
          width: logoFromMediaLibrary.width,
          height: logoFromMediaLibrary.height,
          sortOrder: 0,
        },
        select: { id: true },
      });

      await Promise.all([
        prisma.place.update({
          where: { id: place.id },
          data: { logoImageId: image.id },
        }),
        attachMediaToEntity({
          mediaId: logoFromMediaLibrary.id,
          entityType: MediaEntityType.PLACE,
          entityId: place.id,
          field: "logo",
        }),
      ]);
    }
    timer.mark("media");

    // All validations passed — moderation queue or direct publish (admin)
    if (canPublishContentDirectly(user.role)) {
      await publishPlaceFromDraft(id, user.id);
    } else {
      await submitPlace(id, user.id);
    }
    timer.mark("status");

    const updatedPlace = await prisma.place.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        slug: true,
        updatedAt: true,
      },
    });
    timer.mark("response");
    timer.log({ status: updatedPlace?.status ?? null });

    return NextResponse.json({
      success: true,
      place: updatedPlace,
    });
  } catch (error) {
    timer.log({ error: 1 });
    console.error("Submit place error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/business/places/[id] - Update Place (autosave-friendly)
 * GET /api/business/places/[id] - Get Place details
 * DELETE /api/business/places/[id] - Delete Place
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { MediaEntityType } from "@prisma/client";
import { getActiveRevision } from "@/server/services/placeRevision.service";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManagePlaceAsync } from "@/lib/auth/placeAccess";
import { assignPlaceSlugIfMissing } from "@/lib/slug/placeSlugService";
import { validatePlaceCategoriesDraft } from "@/lib/validation/placeCategoryValidation";
import { createRequestPerf } from "@/server/utils/requestPerf";
import { syncPlaceMediaUsage } from "@/server/services/media/media-usage.service";
import { attachMediaToEntity } from "@/lib/media/mediaRegistry";
import { ensureMediaAssetForStoredFileUrl } from "@/lib/media/ensureMediaAssetForStoredFileUrl";
import { extractMediaRelativePathFromUrl } from "@/server/media/media-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_ID", message: "Place ID is required" },
        { status: 400 }
      );
    }

    const place = await prisma.place.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
        subcategories: {
          orderBy: { position: "asc" },
          select: { categoryId: true, position: true },
        },
        parentPlace: {
          select: {
            id: true,
            title: true,
            formattedAddr: true,
          },
        },
        children: {
          select: {
            id: true,
            title: true,
            unitLabel: true,
            status: true,
          },
        },
        city: {
          select: {
            id: true,
            name: true,
          },
        },
        districtAuto: {
          select: {
            id: true,
            name: true,
          },
        },
        districtManual: {
          select: {
            id: true,
            name: true,
          },
        },
        metroAuto: {
          select: {
            id: true,
            name: true,
          },
        },
        metroManual: {
          select: {
            id: true,
            name: true,
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

    // Get active revision if Place is published
    let activeRevision = null;
    if (place.status === "PUBLISHED") {
      activeRevision = await getActiveRevision(place.id);
    }

    return NextResponse.json({ 
      place,
      activeRevision,
    });
  } catch (error) {
    console.error("[place-get] ❌ Error:", error);
    console.error("[place-get] Stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const perf = createRequestPerf("save-place:route:update");
  try {
    const user = await getCurrentUser();
    perf.mark("auth");
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { error: "MISSING_ID", message: "Place ID is required" },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    perf.mark("parse");

    // Check ownership
    const existing = await prisma.place.findUnique({
      where: { id },
      select: {
        createdByUserId: true,
        ownerBusinessId: true,
        status: true,
        primaryCategoryId: true,
        subcategories: {
          orderBy: { position: "asc" },
          select: { categoryId: true },
        },
      },
    });
    perf.mark("read");

    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Place not found" },
        { status: 404 }
      );
    }

    // Check access using business-based ownership
    const canManage = await canManagePlaceAsync(user, existing);
    if (!canManage) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "You don't have access to this place" },
        { status: 403 }
      );
    }

    // If Place is PUBLISHED, edits must go through PlaceRevision
    // Exception: ADMIN can edit published places directly
    if (existing.status === "PUBLISHED" && user.role !== "ADMIN") {
      return NextResponse.json(
        { 
          error: "PUBLISHED_PLACE_REQUIRES_REVISION",
          message: "Published places must be edited through revisions. Use /api/business/places/[id]/revision endpoint."
        },
        { status: 400 }
      );
    }

    // Валидация категорий если они обновляются
    if (body.primaryCategoryId !== undefined || body.subcategoryIds !== undefined) {
      const categoryValidation = await validatePlaceCategoriesDraft({
        primaryCategoryId: body.primaryCategoryId ?? existing.primaryCategoryId,
        subcategoryIds: body.subcategoryIds,
      });

      if (!categoryValidation.valid) {
        return NextResponse.json(
          {
            error: "CATEGORY_VALIDATION_ERROR",
            message: categoryValidation.error,
            details: categoryValidation.details,
          },
          { status: 400 }
        );
      }
    }
    perf.mark("validate");

    // Lenient validation for autosave - only check types/formats
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = String(body.title);
    if (body.category !== undefined) updateData.category = String(body.category);
    if (body.shortDesc !== undefined) updateData.shortDesc = String(body.shortDesc);
    if (body.description !== undefined) updateData.description = body.description ? String(body.description) : null;
    if (body.logoImageId !== undefined) {
      const v = body.logoImageId;
      if (v === null) {
        updateData.logoImageId = null;
      } else if (typeof v === "string" && v.trim()) {
        const vid = v.trim();
        const placeImageOk = await prisma.placeImage.findFirst({
          where: { placeId: id, id: vid },
          select: { id: true },
        });
        if (placeImageOk) {
          updateData.logoImageId = vid;
        } else {
          // vid may be a TempMedia ID (Instagram import or in-session upload during edit)
          const tempMedia = await prisma.tempMedia.findFirst({
            where: { id: vid, ownerUserId: user.id, status: "TEMP" },
            select: { id: true, url: true, kind: true, width: true, height: true, blurhash: true, sortOrder: true },
          });
          if (tempMedia) {
            const placeImage = await prisma.placeImage.create({
              data: {
                placeId: id,
                kind: "LOGO",
                url: tempMedia.url,
                width: tempMedia.width,
                height: tempMedia.height,
                blurhash: tempMedia.blurhash,
                sortOrder: tempMedia.sortOrder,
              },
            });
            try {
              let mediaAsset = await prisma.mediaAsset.findFirst({
                where: { OR: [{ storageKey: tempMedia.url }, { publicUrl: tempMedia.url }] },
              });
              if (!mediaAsset && extractMediaRelativePathFromUrl(tempMedia.url)) {
                mediaAsset = await ensureMediaAssetForStoredFileUrl({
                  publicUrl: tempMedia.url,
                  uploadedById: user.id,
                  userRole: user.role,
                  width: tempMedia.width,
                  height: tempMedia.height,
                  originalName: "place-logo.webp",
                });
              }
              if (mediaAsset) {
                await attachMediaToEntity({
                  mediaId: mediaAsset.id,
                  entityType: MediaEntityType.PLACE,
                  entityId: id,
                  field: "logo",
                });
              }
            } catch { /* non-fatal — MediaAsset/MediaUsage registration */ }
            await prisma.tempMedia.update({
              where: { id: vid },
              data: { status: "ATTACHED", placeId: id },
            });
            updateData.logoImageId = placeImage.id;
          }
        }
      }
    }
    if (body.phone !== undefined) updateData.phone = body.phone ? String(body.phone) : null;
    if (body.website !== undefined) updateData.website = body.website ? String(body.website) : null;
    if (body.instagramHandle !== undefined) updateData.instagramHandle = body.instagramHandle ? String(body.instagramHandle) : null;
    if (body.instagramUrl !== undefined) updateData.instagramUrl = body.instagramUrl ? String(body.instagramUrl) : null;
    if (body.ageTags !== undefined) updateData.ageTags = Array.isArray(body.ageTags) ? body.ageTags : [];
    if (body.visitFormats !== undefined) updateData.visitFormats = Array.isArray(body.visitFormats) ? body.visitFormats : [];
    if (body.placeKind !== undefined) updateData.placeKind = body.placeKind;
    if (body.parentPlaceId !== undefined) updateData.parentPlaceId = body.parentPlaceId;
    if (body.floor !== undefined) updateData.floor = body.floor ? String(body.floor) : null;
    if (body.unit !== undefined) updateData.unit = body.unit ? String(body.unit) : null;
    if (body.unitLabel !== undefined) updateData.unitLabel = body.unitLabel ? String(body.unitLabel) : null;
    if (body.primaryCategoryId !== undefined) updateData.primaryCategoryId = body.primaryCategoryId || null;
    if (body.discoverySignalIds !== undefined) updateData.discoverySignalIds = Array.isArray(body.discoverySignalIds) ? body.discoverySignalIds : [];

    // Location fields
    if (body.lat !== undefined) updateData.lat = body.lat;
    if (body.lng !== undefined) updateData.lng = body.lng;
    if (body.googlePlaceId !== undefined) updateData.googlePlaceId = body.googlePlaceId;
    if (body.formattedAddr !== undefined) updateData.formattedAddr = body.formattedAddr;
    if (body.customAddress !== undefined) updateData.customAddress = body.customAddress;
    if (body.addressJson !== undefined) updateData.addressJson = body.addressJson;
    if (body.cityId !== undefined) updateData.cityId = body.cityId;
    if (body.districtAutoId !== undefined) updateData.districtAutoId = body.districtAutoId;
    if (body.districtManualId !== undefined) updateData.districtManualId = body.districtManualId;
    if (body.metroAutoId !== undefined) updateData.metroAutoId = body.metroAutoId;
    if (body.metroAutoDistanceM !== undefined) updateData.metroAutoDistanceM = body.metroAutoDistanceM;
    if (body.metroManualId !== undefined) updateData.metroManualId = body.metroManualId;
    if (body.metroManualDistanceM !== undefined) updateData.metroManualDistanceM = body.metroManualDistanceM;
    if (body.googleRating !== undefined) updateData.googleRating = body.googleRating;
    if (body.googleUserRatingsTotal !== undefined) updateData.googleUserRatingsTotal = body.googleUserRatingsTotal;
    if (body.googleReviewsJson !== undefined) updateData.googleReviewsJson = body.googleReviewsJson;
    if (body.googleReviewsSyncedAt !== undefined) updateData.googleReviewsSyncedAt = body.googleReviewsSyncedAt;
    if (body.googleMapsUri !== undefined) updateData.googleMapsUri = body.googleMapsUri;
    if (body.priceItems !== undefined) updateData.priceItems = body.priceItems ?? null;

    await prisma.place.update({
      where: { id },
      data: updateData,
      select: { id: true },
    });

    // Update subcategories if provided — skip deleteMany/createMany when unchanged.
    // Position matters: subcategories are ordered, so comparison is ordered too.
    if (Array.isArray(body.subcategoryIds)) {
      const incomingIds: string[] = body.subcategoryIds.slice(0, 3);
      const existingIds = existing.subcategories.map((s) => s.categoryId);
      const subcategoriesUnchanged =
        incomingIds.length === existingIds.length &&
        incomingIds.every((categoryId, i) => categoryId === existingIds[i]);

      if (!subcategoriesUnchanged) {
        await prisma.placeSubcategory.deleteMany({ where: { placeId: id } });
        if (incomingIds.length > 0) {
          await prisma.placeSubcategory.createMany({
            data: incomingIds.map((categoryId: string, position: number) => ({
              placeId: id,
              categoryId,
              position,
            })),
            skipDuplicates: true,
          });
        }
      }
    }
    perf.mark("write");

    // Auto-assign slug on first meaningful title fill (idempotent).
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (t) {
        await assignPlaceSlugIfMissing(id, t);
      }
    }
    perf.mark("slug");

    const place = await prisma.place.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        slug: true,
        updatedAt: true,
      },
    });
    perf.mark("response");

    // Sync media usage if logo changed (don't block on errors)
    if (body.logoImageId !== undefined) {
      try {
        await syncPlaceMediaUsage(id);
      } catch (error) {
        console.error(`Failed to sync media usage for place ${id}:`, error);
      }
    }

    perf.log({ placeId: id, fields: Object.keys(updateData).length });

    return NextResponse.json({ place });
  } catch (error) {
    console.error("[place-patch] ❌ Error:", error);
    console.error("[place-patch] Stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Internal server error",
        detail: error instanceof Error ? error.stack?.split("\n").slice(0, 3).join(" | ") : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "MISSING_ID", message: "Place ID is required" },
        { status: 400 }
      );
    }

    // Check ownership
    const existing = await prisma.place.findUnique({
      where: { id },
      select: { 
        createdByUserId: true,
        ownerBusinessId: true,
        placeKind: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Place not found" },
        { status: 404 }
      );
    }

    // Check access using business-based ownership
    const canManage = await canManagePlaceAsync(user, existing);
    if (!canManage) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "You don't have access to this place" },
        { status: 403 }
      );
    }

    // Check if COMPLEX has children
    if (existing.placeKind === "COMPLEX") {
      const childrenCount = await prisma.place.count({
        where: { parentPlaceId: id },
      });

      if (childrenCount > 0) {
        return NextResponse.json(
          { 
            error: "HAS_CHILDREN",
            message: "Cannot delete complex with units. Delete units first." 
          },
          { status: 400 }
        );
      }
    }

    await prisma.place.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[place-delete] ❌ Error:", error);
    console.error("[place-delete] Stack:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json(
      {
        error: "INTERNAL_SERVER_ERROR",
        message: "Internal server error"
      },
      { status: 500 }
    );
  }
}

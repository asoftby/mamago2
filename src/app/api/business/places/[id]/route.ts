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
import { normalizePlacePhoneFields } from "@/lib/place/placePhones";
import { normalizeFaqItems } from "@/lib/faq/faqItems";
import {
  assertContentLifecycleOperationAllowed,
  isContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";

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
        phone: true,
        phoneLabel: true,
        phone2: true,
        phone2Label: true,
        phone3: true,
        phone3Label: true,
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

    const normalizedPhones = normalizePlacePhoneFields({
      phone: body.phone !== undefined ? body.phone : existing.phone,
      phoneLabel: body.phoneLabel !== undefined ? body.phoneLabel : existing.phoneLabel,
      phone2: body.phone2 !== undefined ? body.phone2 : existing.phone2,
      phone2Label: body.phone2Label !== undefined ? body.phone2Label : existing.phone2Label,
      phone3: body.phone3 !== undefined ? body.phone3 : existing.phone3,
      phone3Label: body.phone3Label !== undefined ? body.phone3Label : existing.phone3Label,
    });
    const normalizedFaqItems =
      body.faqItems !== undefined ? normalizeFaqItems(body.faqItems) : undefined;

    // Lenient validation for autosave - only check types/formats
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = String(body.title);
    if (body.category !== undefined) updateData.category = String(body.category);
    if (body.shortDesc !== undefined) updateData.shortDesc = String(body.shortDesc);
    if (body.description !== undefined) updateData.description = body.description ? String(body.description) : null;
    if (normalizedFaqItems !== undefined) updateData.faqItems = normalizedFaqItems;
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
    if (
      body.phone !== undefined ||
      body.phoneLabel !== undefined ||
      body.phone2 !== undefined ||
      body.phone2Label !== undefined ||
      body.phone3 !== undefined ||
      body.phone3Label !== undefined
    ) {
      updateData.phone = normalizedPhones.phone;
      updateData.phoneLabel = normalizedPhones.phoneLabel;
      updateData.phone2 = normalizedPhones.phone2;
      updateData.phone2Label = normalizedPhones.phone2Label;
      updateData.phone3 = normalizedPhones.phone3;
      updateData.phone3Label = normalizedPhones.phone3Label;
    }
    if (body.website !== undefined) updateData.website = body.website ? String(body.website) : null;
    if (body.instagramHandle !== undefined) updateData.instagramHandle = body.instagramHandle ? String(body.instagramHandle) : null;
    if (body.instagramUrl !== undefined) updateData.instagramUrl = body.instagramUrl ? String(body.instagramUrl) : null;
    if (body.reelsUrl !== undefined) updateData.reelsUrl = body.reelsUrl ? String(body.reelsUrl) : null;
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

    // Bulk-attach any TEMP media uploaded during this wizard session (gallery photos,
    // and logo if it wasn't already resolved above via a direct logoImageId tempMedia id).
    let attachedSessionMedia = false;
    if (typeof body.wizardSessionId === "string" && body.wizardSessionId.trim()) {
      const sessionId = body.wizardSessionId.trim();
      const tempMediaList = await prisma.tempMedia.findMany({
        where: { ownerUserId: user.id, wizardSessionId: sessionId, status: "TEMP" },
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      });

      if (tempMediaList.length > 0) {
        attachedSessionMedia = true;
        let newLogoImageId: string | null = null;

        for (const media of tempMediaList) {
          const kind = media.kind === "PLACE_LOGO" ? "LOGO" : "GALLERY";

          const placeImage = await prisma.placeImage.create({
            data: {
              placeId: id,
              kind,
              url: media.url,
              width: media.width,
              height: media.height,
              blurhash: media.blurhash,
              sortOrder: media.sortOrder,
            },
          });

          try {
            let mediaAsset = await prisma.mediaAsset.findFirst({
              where: { OR: [{ storageKey: media.url }, { publicUrl: media.url }] },
            });
            if (!mediaAsset && extractMediaRelativePathFromUrl(media.url)) {
              mediaAsset = await ensureMediaAssetForStoredFileUrl({
                publicUrl: media.url,
                uploadedById: user.id,
                userRole: user.role,
                width: media.width,
                height: media.height,
                originalName: kind === "LOGO" ? "place-logo.webp" : "place-gallery.webp",
              });
            }
            if (mediaAsset) {
              await attachMediaToEntity({
                mediaId: mediaAsset.id,
                entityType: MediaEntityType.PLACE,
                entityId: id,
                field: kind === "LOGO" ? "logo" : "gallery",
              });
            }
          } catch {
            /* non-fatal — MediaAsset/MediaUsage registration */
          }

          await prisma.tempMedia.update({
            where: { id: media.id },
            data: { status: "ATTACHED", placeId: id },
          });

          if (kind === "LOGO") {
            newLogoImageId = placeImage.id;
          }
        }

        if (newLogoImageId) {
          updateData.logoImageId = newLogoImageId;
        }
      }
    }

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

    // Sync media usage if logo or gallery changed (don't block on errors)
    if (body.logoImageId !== undefined || attachedSessionMedia) {
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
        status: true,
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

    await assertContentLifecycleOperationAllowed({
      contentType: "PLACE",
      contentId: id,
      operation: "deleteDraft",
      status: existing.status,
      prisma,
    });

    await prisma.place.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isContentLifecycleOperationError(error)) {
      return NextResponse.json(
        lifecycleErrorResponsePayload(error),
        { status: error.statusCode },
      );
    }
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

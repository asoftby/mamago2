/**
 * POST /api/business/places - Create new Place (DRAFT or PENDING)
 * GET /api/business/places - List my Places
 * 
 * IMPORTANT: POST should only be called when user explicitly clicks "Save Draft" or "Submit"
 * Never call this automatically on page load or component mount
 * 
 * Idempotency: Uses createRequestId to prevent duplicate creation
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus, PlaceKind, LocationSource, MediaEntityType } from "@prisma/client";
import { updatePlaceLocation } from "@/services/place/placeLocation.service";
import { extractStreetName } from "@/lib/slug/slugUtils";
import { generatePlaceSlug } from "@/lib/slug/placeSlugService";
import { attachMediaToEntity } from "@/lib/media/mediaRegistry";
import {
  canCreateBusinessContent,
  canPublishContentDirectly,
} from "@/lib/auth/businessContentAccess";
import { getUserBusinessId } from "@/lib/auth/placeAccess";
import {
  nextResponseFromBusinessAccessError,
  requireBusinessPermission,
} from "@/server/permissions/business-permissions";

async function finalizePublishedPlaceSlugIfNeeded(placeId: string, isPublished: boolean) {
  if (!isPublished) return;
  const { assignSlugOnPublish } = await import("@/lib/slug/placeSlugService");
  await assignSlugOnPublish(placeId);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { createRequestId, status, data } = body;

    // Validate required fields
    if (!createRequestId) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "createRequestId is required" },
        { status: 400 }
      );
    }

    const allowedSubmitStatuses = [
      "PENDING",
      ...(canPublishContentDirectly(user.role) ? (["PUBLISHED"] as const) : []),
    ];
    if (
      !status ||
      !(
        status === "DRAFT" ||
        allowedSubmitStatuses.includes(status as "PENDING" | "PUBLISHED")
      )
    ) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: canPublishContentDirectly(user.role)
            ? "status must be DRAFT, PENDING, or PUBLISHED"
            : "status must be DRAFT or PENDING",
        },
        { status: 400 }
      );
    }

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "data is required" },
        { status: 400 }
      );
    }

    const isDraft = status === "DRAFT";
    const isPublished = status === "PUBLISHED";

    // PENDING / PUBLISHED: full profile required. DRAFT: allow empty — DB still needs strings (category defaults to "other").
    if (!isDraft) {
      const t = String(data.title ?? "").trim();
      const c = String(data.category ?? "").trim();
      const s = String(data.shortDesc ?? "").trim();
      if (!t || !c || !s) {
        return NextResponse.json(
          { error: "VALIDATION_ERROR", message: "data.title, data.category, and data.shortDesc are required" },
          { status: 400 }
        );
      }
    }

    const d = isDraft
      ? {
          ...data,
          title: String(data.title ?? "").trim(),
          shortDesc: String(data.shortDesc ?? "").trim(),
          category: String(data.category ?? "").trim() || "other",
        }
      : data;

    // Get user's business (if exists)
    const businessId = await getUserBusinessId(user.id);
    console.log("[places/POST] User business:", businessId);

    if (businessId) {
      try {
        await requireBusinessPermission(user, businessId, "content.create");
      } catch (e) {
        const denied = nextResponseFromBusinessAccessError(e);
        if (denied) return denied;
        throw e;
      }
    }

    // Idempotency check: if place with this createRequestId already exists, return it
    const existingPlace = await prisma.place.findFirst({
      where: {
        createdByUserId: user.id,
        createRequestId,
      },
    });

    if (existingPlace) {
      console.log("[places/POST] ⚡ Idempotent request - returning existing place:", existingPlace.id);
      return NextResponse.json({ place: existingPlace });
    }

    console.log("[places/POST] Creating place for user:", user.id, "title:", d.title, "status:", status);

    // Extract short address from formatted address
    const shortAddress = extractStreetName(d.formattedAddr || "");
    console.log("[places/POST] Extracted shortAddress:", shortAddress);

    // Slug will be generated on publish, not on creation
    const slug = null;
    console.log("[places/POST] Slug will be generated on publish");

    // Determine location source
    const locationSource: LocationSource = d.googlePlaceId ? "GOOGLE" : "MANUAL";

    // Create Place with all provided data
    const place = await prisma.place.create({
      data: {
        createdByUserId: user.id,
        ownerBusinessId: businessId, // Set business owner if user has business
        createRequestId,
        status: status as ContentStatus,
        slug, // Add SEO-friendly slug
        
        // Step 1 fields
        title: d.title,
        shortAddress, // Add short address for disambiguation
        category: d.category,
        shortDesc: d.shortDesc,
        description: d.description || null,
        ageTags: d.ageTags || [],
        visitFormats: d.visitFormats || [],
        activityTypes: d.activityTypes || [],
        
        // Step 2 fields
        lat: d.lat || null,
        lng: d.lng || null,
        googlePlaceId: d.googlePlaceId || null,
        formattedAddr: d.formattedAddr || null,
        addressJson: d.addressJson || null,
        customAddress: d.customAddress || null,
        locationSource,
        cityId: d.cityId || null,
        districtAutoId: d.districtAutoId || null,
        districtManualId: d.districtManualId || null,
        metroAutoId: d.metroAutoId || null,
        metroAutoDistanceM: d.metroAutoDistanceM || null,
        metroManualId: d.metroManualId || null,
        metroManualDistanceM: d.metroManualDistanceM || null,
        
        // Step 3 fields
        logoImageId: d.logoImageId || null,
        
        // Step 4 fields
        phone: d.phone || null,
        website: d.website || null,
        instagramHandle: d.instagramHandle || null,
        instagramUrl: d.instagramUrl || null,
        
        // Hierarchy
        placeKind: d.placeKind || PlaceKind.STANDALONE,
        floor: d.floor || null,
        unit: d.unit || null,
      },
    });

    console.log("[places/POST] ✅ Created place:", place.id, "status:", place.status);

    // Attach temp media if wizardSessionId provided
    if (d.wizardSessionId) {
      console.log("[places/POST] 📎 Attaching temp media from session:", d.wizardSessionId);
      
      try {
        // Get all temp media for this session
        const tempMedia = await prisma.tempMedia.findMany({
          where: {
            ownerUserId: user.id,
            wizardSessionId: d.wizardSessionId,
            status: "TEMP",
          },
          orderBy: [
            { kind: "asc" },
            { sortOrder: "asc" },
          ],
        });

        console.log("[places/POST] Found ${tempMedia.length} temp media items");

        // Convert temp media to PlaceImages
        const placeImages = await Promise.all(
          tempMedia.map(async (media) => {
            const kind = media.kind === "PLACE_LOGO" ? "LOGO" : "GALLERY";
            
            const placeImage = await prisma.placeImage.create({
              data: {
                placeId: place.id,
                kind,
                url: media.url,
                width: media.width,
                height: media.height,
                blurhash: media.blurhash,
                sortOrder: media.sortOrder,
              },
            });

            // Register usage in media library
            try {
              const mediaAsset = await prisma.mediaAsset.findUnique({
                where: { storageKey: media.url },
              });

              if (mediaAsset) {
                await attachMediaToEntity({
                  mediaId: mediaAsset.id,
                  entityType: MediaEntityType.PLACE,
                  entityId: place.id,
                  field: kind === "LOGO" ? "logo" : "gallery",
                });
              }
            } catch (mediaError) {
              console.error("Failed to register media usage:", mediaError);
            }

            return placeImage;
          })
        );

        // Update logoImageId if logo was uploaded
        const logoImage = placeImages.find((img) => img.kind === "LOGO");
        if (logoImage) {
          await prisma.place.update({
            where: { id: place.id },
            data: { logoImageId: logoImage.id },
          });
          console.log("[places/POST] ✅ Set logoImageId:", logoImage.id);
        }

        // Mark temp media as attached
        await prisma.tempMedia.updateMany({
          where: {
            ownerUserId: user.id,
            wizardSessionId: d.wizardSessionId,
            status: "TEMP",
          },
          data: {
            status: "ATTACHED",
            placeId: place.id,
          },
        });

        console.log("[places/POST] ✅ Attached ${placeImages.length} images to place");
      } catch (attachError) {
        console.error("[places/POST] ⚠️ Failed to attach temp media (non-fatal):", attachError);
        // Continue - place is created, images can be uploaded later
      }
    }

    // Run geo enrichment if location data exists
    if (place.lat && place.lng) {
      console.log("[places/POST] 🌍 Running geo enrichment for place:", place.id);
      console.log("[places/POST] Location data:", {
        lat: place.lat,
        lng: place.lng,
        googlePlaceId: place.googlePlaceId,
        formattedAddr: place.formattedAddr,
        hasAddressJson: !!place.addressJson,
      });
      
      try {
        const enrichedPlace = await updatePlaceLocation(place.id, {
          lat: place.lat,
          lng: place.lng,
          googlePlaceId: place.googlePlaceId,
          formattedAddr: place.formattedAddr,
          addressJson: place.addressJson,
          countryCode: place.countryCode,
        });
        
        if (enrichedPlace) {
          console.log("[places/POST] ✅ Geo enrichment complete");
          console.log("[places/POST] Enriched data:", {
            cityId: enrichedPlace.cityId,
            districtAutoId: enrichedPlace.districtAutoId,
            metroAutoId: enrichedPlace.metroAutoId,
            metroAutoDistanceM: enrichedPlace.metroAutoDistanceM,
          });
          
          await finalizePublishedPlaceSlugIfNeeded(place.id, isPublished);

          // Return enriched place with full data
          return NextResponse.json({ 
            place: {
              ...place,
              ...enrichedPlace,
            }
          });
        }
      } catch (enrichError) {
        console.error("[places/POST] ⚠️ Geo enrichment failed (non-fatal):", enrichError);
        console.error("[places/POST] Error stack:", enrichError instanceof Error ? enrichError.stack : "No stack");
        // Continue without enrichment - place is still created
      }
    } else {
      console.log("[places/POST] ℹ️ Skipping geo enrichment (no location data)");
    }

    await finalizePublishedPlaceSlugIfNeeded(place.id, isPublished);

    return NextResponse.json({ place });
  } catch (error) {
    console.error("[places/POST] ❌ Create place error:", error);
    
    // Handle unique constraint violation (shouldn't happen with idempotency check, but just in case)
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "DUPLICATE_REQUEST", message: "Place with this createRequestId already exists" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: "Failed to create place" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Get user's business
    const businessId = await getUserBusinessId(user.id);

    if (businessId) {
      try {
        await requireBusinessPermission(user, businessId, "business.view");
      } catch (e) {
        const denied = nextResponseFromBusinessAccessError(e);
        if (denied) return denied;
        throw e;
      }
    }

    const places = await prisma.place.findMany({
      where: {
        // Show places created by user OR owned by their business
        OR: [
          { createdByUserId: user.id },
          ...(businessId ? [{ ownerBusinessId: businessId }] : []),
        ],
        ...(status && { status: status as ContentStatus }),
      },
      include: {
        images: {
          where: { kind: "LOGO" },
          take: 1,
        },
        _count: {
          select: {
            images: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Enrich places with displayTitle
    const { enrichPlacesWithDisplayTitle } = await import("@/lib/placeHelpers");
    const enrichedPlaces = await enrichPlacesWithDisplayTitle(prisma, places);

    return NextResponse.json({ places: enrichedPlaces });
  } catch (error) {
    console.error("List places error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

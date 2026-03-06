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
import { ContentStatus, PlaceKind, LocationSource } from "@prisma/client";
import { updatePlaceLocation } from "@/services/place/placeLocation.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "BUSINESS_OWNER") {
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

    if (!status || !["DRAFT", "PENDING"].includes(status)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "status must be DRAFT or PENDING" },
        { status: 400 }
      );
    }

    if (!data || !data.title || !data.category || !data.shortDesc) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "data.title, data.category, and data.shortDesc are required" },
        { status: 400 }
      );
    }

    // Idempotency check: if place with this createRequestId already exists, return it
    const existingPlace = await prisma.place.findFirst({
      where: {
        ownerUserId: user.id,
        createRequestId,
      },
    });

    if (existingPlace) {
      console.log("[places/POST] ⚡ Idempotent request - returning existing place:", existingPlace.id);
      return NextResponse.json({ place: existingPlace });
    }

    console.log("[places/POST] Creating place for user:", user.id, "title:", data.title, "status:", status);

    // Determine location source
    const locationSource: LocationSource = data.googlePlaceId ? "GOOGLE" : "MANUAL";

    // Create Place with all provided data
    const place = await prisma.place.create({
      data: {
        ownerUserId: user.id,
        createRequestId,
        status: status as ContentStatus,
        
        // Step 1 fields
        title: data.title,
        category: data.category,
        shortDesc: data.shortDesc,
        description: data.description || null,
        ageTags: data.ageTags || [],
        visitFormats: data.visitFormats || [],
        activityTypes: data.activityTypes || [],
        
        // Step 2 fields
        lat: data.lat || null,
        lng: data.lng || null,
        googlePlaceId: data.googlePlaceId || null,
        formattedAddr: data.formattedAddr || null,
        addressJson: data.addressJson || null,
        customAddress: data.customAddress || null,
        locationSource,
        cityId: data.cityId || null,
        districtAutoId: data.districtAutoId || null,
        districtManualId: data.districtManualId || null,
        metroAutoId: data.metroAutoId || null,
        metroAutoDistanceM: data.metroAutoDistanceM || null,
        metroManualId: data.metroManualId || null,
        metroManualDistanceM: data.metroManualDistanceM || null,
        
        // Step 3 fields
        logoImageId: data.logoImageId || null,
        
        // Step 4 fields
        phone: data.phone || null,
        website: data.website || null,
        instagramHandle: data.instagramHandle || null,
        instagramUrl: data.instagramUrl || null,
        
        // Hierarchy
        placeKind: data.placeKind || PlaceKind.STANDALONE,
        floor: data.floor || null,
        unit: data.unit || null,
      },
    });

    console.log("[places/POST] ✅ Created place:", place.id, "status:", place.status);

    // Attach temp media if wizardSessionId provided
    if (data.wizardSessionId) {
      console.log("[places/POST] 📎 Attaching temp media from session:", data.wizardSessionId);
      
      try {
        // Get all temp media for this session
        const tempMedia = await prisma.tempMedia.findMany({
          where: {
            ownerUserId: user.id,
            wizardSessionId: data.wizardSessionId,
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
            
            return prisma.placeImage.create({
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
            wizardSessionId: data.wizardSessionId,
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
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const places = await prisma.place.findMany({
      where: {
        ownerUserId: user.id,
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

    return NextResponse.json({ places });
  } catch (error) {
    console.error("List places error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

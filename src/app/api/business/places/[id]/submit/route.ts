/**
 * POST /api/business/places/[id]/submit
 * Submit Place for moderation (strict validation)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { ContentStatus, PlaceKind } from "@prisma/client";
import { submitPlace } from "@/server/services/moderation.service";

interface ValidationError {
  error: "VALIDATION";
  missing: string[];
  fields: Record<string, string>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get place with images
    const place = await prisma.place.findUnique({
      where: { id: params.id },
      include: {
        images: true,
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Check ownership
    if (place.ownerUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check current status (can only submit from DRAFT, REJECTED, NEEDS_CHANGES)
    if (
      place.status !== ContentStatus.DRAFT &&
      place.status !== ContentStatus.REJECTED &&
      place.status !== ContentStatus.NEEDS_CHANGES
    ) {
      return NextResponse.json(
        { error: `Cannot submit from status: ${place.status}` },
        { status: 400 }
      );
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
    if (!place.logoImageId || !logoImage) {
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

    // All validations passed - submit for moderation
    await submitPlace(params.id, user.id);

    // Fetch updated place
    const updatedPlace = await prisma.place.findUnique({
      where: { id: params.id },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      place: updatedPlace,
    });
  } catch (error) {
    console.error("Submit place error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

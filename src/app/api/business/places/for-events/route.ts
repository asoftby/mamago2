import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getUserBusinessId } from "@/lib/auth/placeAccess";

/**
 * GET /api/business/places/for-events
 * Fetch user's places with full location data for event wizard
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's business
    const businessId = await getUserBusinessId(user.id);

    const places = await prisma.place.findMany({
      where: {
        OR: [
          { createdByUserId: user.id },
          ...(businessId ? [{ ownerBusinessId: businessId }] : []),
        ],
        archivedAt: null,
        status: { in: ["PUBLISHED", "NEEDS_REVISION"] }, // Only approved places
      },
      select: {
        id: true,
        title: true,
        shortAddress: true,
        formattedAddr: true,
        lat: true,
        lng: true,
        cityId: true,
        districtAutoId: true,
        districtManualId: true,
        metroAutoId: true,
        metroAutoDistanceM: true,
        metroManualId: true,
        metroManualDistanceM: true,
        // Include related data for display
        city: {
          select: {
            id: true,
            name: true,
            slug: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform for event wizard
    const transformedPlaces = places.map(place => ({
      id: place.id,
      title: place.title,
      address: place.formattedAddr || place.shortAddress || "",
      displayAddress: place.formattedAddr || place.shortAddress || "",
      fullAddress: place.formattedAddr || "",
      lat: place.lat,
      lng: place.lng,
      cityId: place.cityId,
      cityName: place.city?.name || "",
      citySlug: place.city?.slug || "",
      // District data (prefer manual over auto)
      districtId: place.districtManualId || place.districtAutoId,
      districtName: place.districtManual?.name || place.districtAuto?.name,
      // Metro data (prefer manual over auto)
      metroId: place.metroManualId || place.metroAutoId,
      metroName: place.metroManual?.name || place.metroAuto?.name,
      metroDistanceM: place.metroManualDistanceM ?? place.metroAutoDistanceM,
    }));

    return NextResponse.json({ places: transformedPlaces });
  } catch (error) {
    console.error("Failed to fetch places for events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

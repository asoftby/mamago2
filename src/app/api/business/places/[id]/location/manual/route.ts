/**
 * POST /api/business/places/[id]/location/manual
 * Set location manually (without Google Places)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { updatePlaceLocation } from "@/services/place/placeLocation.service";
import { Prisma } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let placeId: string | undefined;
  
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;
    placeId = id;

    // Check ownership
    const existing = await prisma.place.findUnique({
      where: { id },
      select: { ownerUserId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Place not found" },
        { status: 404 }
      );
    }

    if (existing.ownerUserId !== user.id) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "You don't have access to this place" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { lat, lng, customAddress, cityId, countryCode } = body;

    // Validate required fields
    if (lat === undefined || lng === undefined) {
      return NextResponse.json(
        { 
          error: "VALIDATION_ERROR", 
          message: "lat and lng are required" 
        },
        { status: 400 }
      );
    }

    // Use unified location service
    const updatedPlace = await updatePlaceLocation(id, {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      formattedAddr: customAddress || null,
      countryCode: countryCode || null,
    });

    return NextResponse.json({ place: updatedPlace });
    
  } catch (error) {
    // Log full error details
    console.error("[place-location-manual] ❌ Error:", error);
    console.error("[place-location-manual] Stack:", error instanceof Error ? error.stack : "No stack");
    console.error("[place-location-manual] PlaceId:", placeId);
    
    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025: Record not found
      if (error.code === "P2025") {
        return NextResponse.json(
          {
            error: "NOT_FOUND",
            message: "Place not found",
          },
          { status: 404 }
        );
      }
      
      // Other Prisma errors
      return NextResponse.json(
        {
          error: "DATABASE_ERROR",
          message: error.message || "Database operation failed",
          code: error.code,
        },
        { status: 500 }
      );
    }
    
    // Handle validation errors
    if (error instanceof Error && error.message.includes("validation")) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: error.message,
        },
        { status: 400 }
      );
    }
    
    // Generic error fallback
    return NextResponse.json(
      { 
        error: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to save location",
      },
      { status: 500 }
    );
  }
}

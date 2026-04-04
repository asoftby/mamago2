/**
 * POST /api/business/places/[id]/claim
 * Request ownership/access to an existing place
 * Requires user to have a business (businessId is required)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { getUserBusinessId } from "@/lib/auth/placeAccess";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const placeId = params.id;

    // Get user's business ID (required for claim)
    const businessId = await getUserBusinessId(user.id);
    
    if (!businessId) {
      return NextResponse.json(
        { error: "Business required. You must have a business to claim a place." },
        { status: 400 }
      );
    }

    // Check if place exists
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { 
        id: true, 
        title: true, 
        ownerBusinessId: true,
        createdByUserId: true,
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Check if business already owns this place
    if (place.ownerBusinessId === businessId) {
      return NextResponse.json(
        { error: "Your business already owns this place" },
        { status: 400 }
      );
    }

    // Check if there's already a pending request (idempotent)
    const existingRequest = await prisma.placeClaimRequest.findFirst({
      where: {
        placeId,
        businessId,
        status: "PENDING",
      },
    });

    if (existingRequest) {
      return NextResponse.json({
        ok: true,
        requestId: existingRequest.id,
        message: "Request already exists",
      });
    }

    // Create claim request
    const claimRequest = await prisma.placeClaimRequest.create({
      data: {
        placeId,
        userId: user.id,
        businessId, // Required
        status: "PENDING",
      },
    });

    return NextResponse.json({
      ok: true,
      requestId: claimRequest.id,
      message: "Claim request created",
    });
  } catch (error) {
    console.error("[API] Place claim error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

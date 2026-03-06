/**
 * POST /api/business/places/[id]/claim
 * Request ownership/access to an existing place
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "BUSINESS_OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const placeId = params.id;

    // Check if place exists
    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { id: true, title: true, ownerUserId: true },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    // Check if user already owns this place
    if (place.ownerUserId === user.id) {
      return NextResponse.json(
        { error: "You already own this place" },
        { status: 400 }
      );
    }

    // Check if there's already a pending request (idempotent)
    const existingRequest = await prisma.placeClaimRequest.findFirst({
      where: {
        placeId,
        userId: user.id,
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

    // Get user's business ID (if exists)
    const business = await prisma.business.findUnique({
      where: { ownerUserId: user.id },
      select: { id: true },
    });

    // Create claim request
    const claimRequest = await prisma.placeClaimRequest.create({
      data: {
        placeId,
        userId: user.id,
        businessId: business?.id || null,
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

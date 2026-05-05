// API endpoint to check which images are already used in offers
// Used for photo uniqueness validation in MVP wizard

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import {
  canCreateBusinessContent,
  canManageOwnedContent,
} from "@/lib/auth/businessContentAccess";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get("placeId");
    const currentOfferId = searchParams.get("currentOfferId"); // Exclude current offer in edit mode

    if (!placeId) {
      return NextResponse.json(
        { error: "placeId is required" },
        { status: 400 }
      );
    }

    const place = await prisma.place.findUnique({
      where: { id: placeId },
      select: { ownerBusinessId: true },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    if (!place.ownerBusinessId || !canManageOwnedContent(user, place.ownerBusinessId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const offers = await prisma.offer.findMany({
      where: {
        placeId,
        id: currentOfferId ? { not: currentOfferId } : undefined,
      },
      select: {
        id: true,
        coverImage: true,
      },
    });

    const usedImages: Record<string, string> = {};

    for (const offer of offers) {
      if (offer.coverImage) {
        usedImages[offer.coverImage] = offer.id;
      }
    }

    return NextResponse.json({
      usedImages,
      count: Object.keys(usedImages).length,
    });
  } catch (error) {
    console.error("Check images error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

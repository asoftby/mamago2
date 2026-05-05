// API endpoint to check which images are already used in offers
// Used for photo uniqueness validation in MVP wizard

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
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
    
    // Get all offers for this place
    const offers = await prisma.offer.findMany({
      where: {
        placeId,
        id: currentOfferId ? { not: currentOfferId } : undefined,
      },
      select: {
        id: true,
        coverImage: true,
        gallery: true,
      },
    });
    
    // Build a map of image URL -> offer ID
    const usedImages: Record<string, string> = {};
    
    for (const offer of offers) {
      if (offer.coverImage) {
        usedImages[offer.coverImage] = offer.id;
      }
      
      if (offer.gallery && Array.isArray(offer.gallery)) {
        for (const imageUrl of offer.gallery) {
          if (typeof imageUrl === "string") {
            usedImages[imageUrl] = offer.id;
          }
        }
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

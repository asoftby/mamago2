import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { getPlaceDisplayTitle, hasDuplicateTitleInCity } from "@/lib/placeDisplayTitle";

/**
 * GET /api/admin/places/[id]/display-info
 * Get display title and duplicate information for a place
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const place = await prisma.place.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        shortAddress: true,
        cityId: true,
      },
    });

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const displayTitle = await getPlaceDisplayTitle(prisma, place);
    const hasDuplicates = await hasDuplicateTitleInCity(
      prisma,
      place.title,
      place.cityId,
      place.id
    );

    return NextResponse.json({
      displayTitle,
      hasDuplicates,
      title: place.title,
      shortAddress: place.shortAddress,
    });
  } catch (error: any) {
    console.error("[API] Get display info error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get display info" },
      { status: 500 }
    );
  }
}

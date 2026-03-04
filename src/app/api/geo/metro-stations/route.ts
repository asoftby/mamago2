import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/geo/metro-stations
 * Fetch metro stations for a city
 * Query params: citySlug (required)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const citySlug = searchParams.get("citySlug");

    if (!citySlug) {
      return NextResponse.json(
        { error: "citySlug is required" },
        { status: 400 }
      );
    }

    // Find city by slug
    const city = await prisma.city.findUnique({
      where: { slug: citySlug },
      select: { id: true },
    });

    if (!city) {
      return NextResponse.json(
        { error: "City not found" },
        { status: 404 }
      );
    }

    // Fetch metro stations for the city
    const metroStations = await prisma.metroStation.findMany({
      where: {
        cityId: city.id,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ metroStations });
  } catch (error) {
    console.error("Error fetching metro stations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

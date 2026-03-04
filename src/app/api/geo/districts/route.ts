import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/geo/districts
 * Fetch districts for a city
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

    // Fetch districts for the city
    const districts = await prisma.district.findMany({
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

    return NextResponse.json({ districts });
  } catch (error) {
    console.error("Error fetching districts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

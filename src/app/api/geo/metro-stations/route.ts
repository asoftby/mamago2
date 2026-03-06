/**
 * GET /api/geo/metro-stations?cityId=xxx
 * Get all metro stations for a city
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get("cityId");

    if (!cityId) {
      return NextResponse.json(
        { error: "cityId is required" },
        { status: 400 }
      );
    }

    const stations = await prisma.metroStation.findMany({
      where: { cityId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({ stations });
  } catch (error) {
    console.error("Get metro stations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

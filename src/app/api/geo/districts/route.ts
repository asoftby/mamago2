/**
 * GET /api/geo/districts?cityId=xxx
 * Get all districts for a city
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

    const districts = await prisma.district.findMany({
      where: { cityId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({ districts });
  } catch (error) {
    console.error("Get districts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

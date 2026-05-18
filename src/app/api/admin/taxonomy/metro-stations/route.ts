import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  const searchParams = request.nextUrl.searchParams;
  const cityId = searchParams.get("cityId");

  if (!cityId) {
    return NextResponse.json({ error: "City ID is required" }, { status: 400 });
  }

  try {
    const stations = await prisma.metroStation.findMany({
      where: { cityId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(stations);
  } catch (error) {
    console.error("Error fetching metro stations:", error);
    return NextResponse.json({ error: "Failed to fetch metro stations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { cityId, name, lat, lng, osmType, osmId } = body;

    if (!cityId || !name || lat === undefined || lng === undefined || !osmType || !osmId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const station = await prisma.metroStation.create({
      data: {
        cityId,
        name: name.trim(),
        lat: Number(lat),
        lng: Number(lng),
        osmType,
        osmId,
      },
    });

    return NextResponse.json(station, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating metro station:", error);
    
    if (error && typeof error === 'object' && 'code' in error && error.code === "P2002") {
      return NextResponse.json({ error: "Такая станция уже существует (дубликат имени или OSM ID)" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create metro station" }, { status: 500 });
  }
}

/**
 * GET /api/routes/stops/search?q=...
 * Searches mamaGo Places by title/address for route stop resolution.
 * Returns up to 5 results. No auth required (public catalog data).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const places = await prisma.place.findMany({
      where: {
        AND: [
          getPublicPublishedPlaceWhere(),
          {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { formattedAddr: { contains: q, mode: "insensitive" } },
              { customAddress: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        formattedAddr: true,
        customAddress: true,
        lat: true,
        lng: true,
        city: { select: { id: true, name: true } },
      },
      take: 5,
      orderBy: { title: "asc" },
    });

    const results = places.map((p) => ({
      id: p.id,
      title: p.title,
      address: p.formattedAddr ?? p.customAddress ?? "",
      cityId: p.city?.id ?? null,
      cityName: p.city?.name ?? null,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[API] routes/stops/search error:", err);
    return NextResponse.json({ results: [] });
  }
}

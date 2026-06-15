/**
 * GET /api/business/places/search?q=...
 * Searches user's places and public places for event location selection.
 * Returns up to 10 results prioritizing user's own places.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getUserBusinessId } from "@/lib/auth/placeAccess";
import { getPublicPublishedPlaceWhere } from "@/server/public/publicContentVisibility";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const ownOnly = request.nextUrl.searchParams.get("scope") === "own";
  
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const user = await getCurrentUser();
    const businessId = user ? await getUserBusinessId(user.id) : null;
    const ownPlaceWhere = user
      ? {
          OR: [
            { createdByUserId: user.id },
            ...(businessId ? [{ ownerBusinessId: businessId }] : []),
          ],
        }
      : null;
    
    // Search in user's places first (if authenticated)
    const userPlaces = user && ownPlaceWhere
      ? await prisma.place.findMany({
          where: {
            AND: [
              ownPlaceWhere,
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
            cityId: true,
            districtAutoId: true,
            districtManualId: true,
            metroAutoId: true,
            metroAutoDistanceM: true,
            metroManualId: true,
            metroManualDistanceM: true,
            city: { select: { id: true, name: true, slug: true } },
          },
          take: 5,
          orderBy: { title: "asc" },
        })
      : [];

    if (ownOnly) {
      const results = userPlaces.map((p) => ({
        id: p.id,
        title: p.title,
        address: p.formattedAddr ?? p.customAddress ?? "",
        fullAddress: p.formattedAddr ?? p.customAddress ?? "",
        cityId: p.city?.id ?? p.cityId ?? null,
        cityName: p.city?.name ?? null,
        citySlug: p.city?.slug ?? null,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        districtId: p.districtManualId ?? p.districtAutoId ?? null,
        districtName: null,
        metroId: p.metroManualId ?? p.metroAutoId ?? null,
        metroName: null,
        metroDistanceM: p.metroManualDistanceM ?? p.metroAutoDistanceM ?? null,
        isOwn: true,
      }));
      return NextResponse.json({ results });
    }

    // Search in public places
    const publicPlaces = await prisma.place.findMany({
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
          // Exclude user's own places from public results
          ...(userPlaces.length > 0
            ? [{ id: { notIn: userPlaces.map((p) => p.id) } }]
            : []),
        ],
      },
      select: {
        id: true,
        title: true,
        formattedAddr: true,
        customAddress: true,
        lat: true,
        lng: true,
        cityId: true,
        districtAutoId: true,
        districtManualId: true,
        metroAutoId: true,
        metroAutoDistanceM: true,
        metroManualId: true,
        metroManualDistanceM: true,
        city: { select: { id: true, name: true, slug: true } },
      },
      take: 5,
      orderBy: { title: "asc" },
    });

    // Combine results: user places first, then public
    const allPlaces = [...userPlaces, ...publicPlaces].slice(0, 10);

    const results = allPlaces.map((p) => ({
      id: p.id,
      title: p.title,
      address: p.formattedAddr ?? p.customAddress ?? "",
      fullAddress: p.formattedAddr ?? p.customAddress ?? "",
      cityId: p.city?.id ?? p.cityId ?? null,
      cityName: p.city?.name ?? null,
      citySlug: p.city?.slug ?? null,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      districtId: p.districtManualId ?? p.districtAutoId ?? null,
      districtName: null, // Will be resolved by client if needed
      metroId: p.metroManualId ?? p.metroAutoId ?? null,
      metroName: null, // Will be resolved by client if needed
      metroDistanceM: p.metroManualDistanceM ?? p.metroAutoDistanceM ?? null,
      isOwn: user ? userPlaces.some((up) => up.id === p.id) : false,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[API] business/places/search error:", err);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}

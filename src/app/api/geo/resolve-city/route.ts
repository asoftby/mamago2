/**
 * POST /api/geo/resolve-city
 * 
 * Lightweight endpoint to resolve cityId from coordinates and addressJson
 * Used by wizard to show city immediately without creating Place
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveCityId } from "@/services/place/cityResolver.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lat, lng, addressJson } = body;

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "lat and lng are required" },
        { status: 400 }
      );
    }

    console.log("[resolve-city] Resolving city for:", { lat, lng, hasAddressJson: !!addressJson });

    const result = await resolveCityId({
      lat,
      lng,
      addressJson: addressJson || null,
    });

    if (result.cityId) {
      console.log("[resolve-city] ✅ Resolved:", result.cityName, result.cityId);
      return NextResponse.json({
        cityId: result.cityId,
        cityName: result.cityName,
        confidence: result.confidence,
      });
    } else {
      console.log("[resolve-city] ⚠️ Could not resolve city");
      return NextResponse.json({
        cityId: null,
        cityName: null,
        confidence: null,
      });
    }
  } catch (error) {
    console.error("[resolve-city] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

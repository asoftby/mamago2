import { NextResponse } from "next/server";
import { REFERENCE_DATA_CACHE_CONTROL } from "@/lib/http/referenceDataCacheHeaders";
import { listPublicCitySelectorOptions } from "@/server/city/publicCitySelector";

const CACHE_HEADERS = { "Cache-Control": REFERENCE_DATA_CACHE_CONTROL };

export async function GET() {
  try {
    const cities = await listPublicCitySelectorOptions();
    return NextResponse.json({ cities }, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error("[public/cities GET]", error);
    return NextResponse.json(
      { cities: [] },
      { status: 200, headers: CACHE_HEADERS },
    );
  }
}

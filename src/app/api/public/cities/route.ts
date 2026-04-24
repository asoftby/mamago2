import { NextResponse } from "next/server";
import { listPublicCitySelectorOptions } from "@/server/city/publicCitySelector";

export async function GET() {
  try {
    const cities = await listPublicCitySelectorOptions();
    return NextResponse.json({ cities });
  } catch (error) {
    console.error("[public/cities GET]", error);
    return NextResponse.json({ cities: [] }, { status: 200 });
  }
}

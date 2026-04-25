import { NextRequest, NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { getCityCoordinates } from "@/lib/weather/cityCoordinates";
import { transformWeatherData } from "@/lib/weather/transformWeatherData";
import type { OpenMeteoHourlyResponse } from "@/lib/weather/types";

/**
 * GET /api/weather/weekly?city=minsk
 * 
 * Fetches 7-day weather forecast for a city
 * Cached for 30 minutes
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const citySlug = searchParams.get("city") || "minsk";

    const coordinates = getCityCoordinates(citySlug);
    if (!coordinates) {
      return NextResponse.json(
        { error: "City not found" },
        { status: 404 }
      );
    }

    // Date range: today + 7 days
    const today = new Date();
    const endDate = addDays(today, 7);

    const startDateStr = format(today, "yyyy-MM-dd");
    const endDateStr = format(endDate, "yyyy-MM-dd");

    // Fetch from Open-Meteo
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", coordinates.lat.toString());
    url.searchParams.set("longitude", coordinates.lon.toString());
    url.searchParams.set("hourly", "temperature_2m,weathercode");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("start_date", startDateStr);
    url.searchParams.set("end_date", endDateStr);

    const response = await fetch(url.toString(), {
      next: {
        revalidate: 1800, // 30 minutes
        tags: [`weather:${citySlug}`],
      },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const data = (await response.json()) as OpenMeteoHourlyResponse;

    // Transform to our format
    const weeklyData = transformWeatherData(data, citySlug);

    return NextResponse.json(weeklyData);
  } catch (error) {
    console.error("[weather/weekly] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { generateHeroCopyWithSelection } from "@/features/hero-weather/model/hero-copy-engine";
import type { HeroPersonaContext } from "@/features/hero-weather/model/hero-copy-engine";

/**
 * GET /api/hero-greeting?scenario=great_outdoor&mode=guest&cityName=Минске
 *
 * Returns a fresh hero title + subtitle for the given weather scenario.
 * Used client-side to update the hero when the browser's weather differs
 * from the SSR-cached weather.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scenario = searchParams.get("scenario") ?? "unknown";
  const mode = (searchParams.get("mode") ?? "guest") as HeroPersonaContext["mode"];
  const cityName = searchParams.get("cityName") ?? undefined;
  const timeOfDay = (searchParams.get("timeOfDay") ?? "day") as "morning" | "day" | "evening" | "night";

  const persona: HeroPersonaContext = { mode, userName: null, childName: null };

  const generated = generateHeroCopyWithSelection({
    weather: { scenario, timeOfDay, emoji: "" },
    persona,
    cityName,
  });

  return NextResponse.json(
    { title: generated.title, subtitle: generated.subtitle },
    { headers: { "Cache-Control": "no-store" } },
  );
}

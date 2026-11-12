import { NextResponse } from "next/server";
import { isDayScenarioEngineEnabled } from "@/server/services/dayScenarioEngine/flag";

/**
 * GET /api/plan/day-scenario/config — whether the day-scenario screen is on for this environment.
 * No database, no user data: the same answer for everybody, so the browser may keep it for a few
 * minutes (the client also remembers it for the page session). The flag is read at request time,
 * so a statically generated page cannot freeze a stale value.
 */
export async function GET() {
  return NextResponse.json(
    { enabled: isDayScenarioEngineEnabled() },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}

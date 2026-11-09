import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { isDayScenarioEngineEnabled } from "@/server/services/dayScenarioEngine/flag";
import { isStoredTravelMode, setFamilyTravelMode } from "@/server/services/dayScenarioEngine/travelMode.service";

/**
 * PUT /api/plan/day-scenario/travel-mode { mode: "walk" | "car" } — remembers the family's choice of «Пешком / На
 * машине» (the draft's default next time). Behind DAY_SCENARIO_ENGINE_ENABLED (404 when off, before any database
 * work); signed-in users, 20 a minute.
 */
export async function PUT(request: NextRequest) {
  if (!isDayScenarioEngineEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ code: "INVALID_PAYLOAD" }, { status: 400 });
    }
    const mode = (body as { mode?: unknown } | null)?.mode;
    if (!isStoredTravelMode(mode)) return NextResponse.json({ code: "INVALID_MODE" }, { status: 400 });
    const limit = await checkRateLimit(`day-scenario-travel-mode:${user.id}`, 20, 60_000);
    if (!limit.allowed) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
    await setFamilyTravelMode(user.id, mode);
    return NextResponse.json({ mode }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[PUT /api/plan/day-scenario/travel-mode]", error);
    return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

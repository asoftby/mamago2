import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { isDayScenarioEngineEnabled } from "@/server/services/dayScenarioEngine/flag";
import { deleteSavedDays, listSavedDayPoints, parseDeleteRequest, SavedDayError } from "@/server/services/dayScenarioEngine/savedDay.service";
import { calendarDaySchema } from "@/lib/decision/planRequestSchemas";

/**
 * GET /api/plan/day-scenario/saved?date=YYYY-MM-DD — the points of a saved «День от mamaGo» (for «Изменить день»).
 * Same gate as the delete: flag, sign-in, 60 a minute.
 */
export async function GET(request: NextRequest) {
  if (!isDayScenarioEngineEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    const date = calendarDaySchema.safeParse(request.nextUrl.searchParams.get("date") ?? "");
    if (!date.success) return NextResponse.json({ code: "INVALID_DATE" }, { status: 400 });
    const limit = await checkRateLimit(`day-scenario-saved-read:${user.id}`, 60, 60_000);
    if (!limit.allowed) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
    return NextResponse.json({ points: await listSavedDayPoints(user.id, date.data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[GET /api/plan/day-scenario/saved]", error);
    return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/**
 * DELETE /api/plan/day-scenario/saved?date=YYYY-MM-DD&scope=day|group — remove a saved «День от mamaGo» (or all days
 * of its group, e.g. the weekend). Only the entries the scenario created are deleted. Behind
 * DAY_SCENARIO_ENGINE_ENABLED (404 when off, before any database work); signed-in users, 20 a minute.
 */
export async function DELETE(request: NextRequest) {
  if (!isDayScenarioEngineEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    const { date, scope } = parseDeleteRequest(request.nextUrl.searchParams.get("date"), request.nextUrl.searchParams.get("scope"));
    const limit = await checkRateLimit(`day-scenario-delete:${user.id}`, 20, 60_000);
    if (!limit.allowed) return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429 });
    const result = await deleteSavedDays(user.id, date, scope);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof SavedDayError) return NextResponse.json({ code: error.code }, { status: error.status });
    console.error("[DELETE /api/plan/day-scenario/saved]", error);
    return NextResponse.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

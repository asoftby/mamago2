import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { resolvePlanOwner } from "@/server/services/planOwner";
import {
  listFamilyCalendarItems,
  ManualPlanEntryError,
} from "@/server/services/manualPlanEntry.service";
import { buildScopedPlanDayMarkers } from "@/server/services/planDayMarkers";
import { parsePlanScopeFilter } from "@/features/my-plan/lib/planVisibilityView";

/**
 * Lightweight day aggregates for the plan calendar: date → distinct owners
 * ("family" or childId). Same visibility scope as /api/plan/calendar, but no
 * item details, scenarios or booking state.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const from = request.nextUrl.searchParams.get("from") ?? "";
    const to = request.nextUrl.searchParams.get("to") ?? "";
    const scope = parsePlanScopeFilter(request.nextUrl.searchParams.get("scope"));
    const items = await listFamilyCalendarItems({ owner: await resolvePlanOwner(user.id), from, to });
    return NextResponse.json(
      { markers: buildScopedPlanDayMarkers(items, scope, user.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof ManualPlanEntryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[plan-day-markers] read failed", { userId: user.id });
    return NextResponse.json({ error: "day_markers_failed" }, { status: 500 });
  }
}

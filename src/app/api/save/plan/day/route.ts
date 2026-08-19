/**
 * GET /api/save/plan/day?date=YYYY-MM-DD
 * Returns plan items for a specific date (for smart scheduling)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listPlanItemsByDate } from "@/server/services/plan.service";
import { getDayScenario, computePlanFingerprint } from "@/server/services/dayScenario.service";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const items = await listPlanItemsByDate(user.id, date);

  // Reuses this same per-date fetch (no extra round trip) so every My Plan
  // surface — full page and overlay alike — can show the same Scenario CTA
  // state (Task 7 "single converged entry point" requirement).
  const scenario = await getDayScenario(user.id, date);
  const scenarioStatus = scenario
    ? computePlanFingerprint(items) === scenario.planFingerprint
      ? "ready"
      : "changed"
    : null;

  return NextResponse.json({ items, scenarioStatus });
}

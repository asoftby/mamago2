/**
 * GET /api/save/plan/upcoming?from=YYYY-MM-DD
 * Returns all plan items from `from` date onwards (default: today, up to 90 days).
 * Used by the "Мой план" widget to find the nearest planned event.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listUpcomingPlanItems } from "@/server/services/plan.service";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from =
    new URL(req.url).searchParams.get("from") ??
    new Date().toISOString().split("T")[0]!;

  const items = await listUpcomingPlanItems(user.id, from);
  return NextResponse.json({ items });
}

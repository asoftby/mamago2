/**
 * GET /api/save/plan/day?date=YYYY-MM-DD
 * Returns plan items for a specific date (for smart scheduling)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listPlanItemsByDate } from "@/server/services/plan.service";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const items = await listPlanItemsByDate(user.id, date);
  return NextResponse.json({ items });
}

import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import type { AnalyticsOverviewDateRange } from "@/lib/analytics/adminOverviewTypes";
import { resolveAnalyticsDateRange } from "@/server/services/analytics/analyticsDateRange";
import {
  detailOpenTrackingStatusForRange,
  getDetailOpenTrackingFixedAt,
} from "@/server/services/analytics/detailOpenTrackingFix";

const DATE_RANGES: AnalyticsOverviewDateRange[] = ["today", "7d", "30d", "90d", "1y"];

/** A4: does the selected Analytics period include pre-fix (bot-inflated) DETAIL_OPEN data? */
export async function GET(request: NextRequest) {
  try {
    await requireRole([Role.ADMIN, Role.MODERATOR]);
    const raw = request.nextUrl.searchParams.get("dateRange") ?? "30d";
    const dateRange = DATE_RANGES.includes(raw as AnalyticsOverviewDateRange)
      ? (raw as AnalyticsOverviewDateRange)
      : "30d";
    const { start } = resolveAnalyticsDateRange(dateRange);
    const fixedAt = await getDetailOpenTrackingFixedAt(prisma);
    return NextResponse.json(detailOpenTrackingStatusForRange(fixedAt, start));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("NEXT_REDIRECT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "Insufficient permissions") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/admin/analytics/tracking-status:", error);
    return NextResponse.json({ error: "Failed to load tracking status" }, { status: 500 });
  }
}

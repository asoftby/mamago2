import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/server";
import type { AnalyticsOverviewDateRange } from "@/lib/analytics/adminOverviewTypes";
import type { AnalyticsSegmentsFilters } from "@/lib/analytics/analyticsSegmentsTypes";
import { getAnalyticsSegmentDetail } from "@/server/services/analytics/analyticsSegments.service";

const DATE_RANGES: AnalyticsOverviewDateRange[] = [
  "today",
  "7d",
  "30d",
  "90d",
  "1y",
];

function parseFilters(searchParams: URLSearchParams): AnalyticsSegmentsFilters {
  const dr = searchParams.get("dateRange") ?? "30d";
  const dateRange = DATE_RANGES.includes(dr as AnalyticsOverviewDateRange)
    ? (dr as AnalyticsOverviewDateRange)
    : "30d";
  return {
    dateRange,
    city: searchParams.get("city") ?? "",
  };
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ segmentKey: string }> },
) {
  try {
    await requireRole([Role.ADMIN, Role.MODERATOR]);
    const { segmentKey } = await ctx.params;
    const filters = parseFilters(request.nextUrl.searchParams);
    const data = await getAnalyticsSegmentDetail(segmentKey, filters);
    if (!data) {
      return NextResponse.json({ error: "Unknown segment" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("NEXT_REDIRECT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "Insufficient permissions") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/admin/analytics/segments/[segmentKey]:", error);
    return NextResponse.json(
      { error: msg || "Failed to load segment" },
      { status: 500 },
    );
  }
}

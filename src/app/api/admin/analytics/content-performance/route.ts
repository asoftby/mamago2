import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/server";
import type {
  AnalyticsOverviewDateRange,
  AnalyticsOverviewFilters,
} from "@/lib/analytics/adminOverviewTypes";
import { getAnalyticsContentPerformance } from "@/server/services/analytics/analyticsContentPerformance.service";

const DATE_RANGES: AnalyticsOverviewDateRange[] = [
  "today",
  "7d",
  "30d",
  "90d",
  "1y",
];

const SORT_KEYS = new Set([
  "views",
  "opens",
  "saves",
  "planAdds",
  "ctaClicks",
  "openRate",
  "saveRate",
  "planRate",
  "clickRateVsOpens",
  "clickRateVsPlans",
  "title",
]);

function parseFilters(searchParams: URLSearchParams): AnalyticsOverviewFilters {
  const dr = searchParams.get("dateRange") ?? "30d";
  const dateRange = DATE_RANGES.includes(dr as AnalyticsOverviewDateRange)
    ? (dr as AnalyticsOverviewDateRange)
    : "30d";

  return {
    dateRange,
    entity: searchParams.get("entity") ?? "all",
    vertical: searchParams.get("vertical") ?? "all",
    city: searchParams.get("city") ?? "",
    segment: searchParams.get("segment") ?? "",
    childAgeBand: searchParams.get("childAgeBand") ?? "",
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireRole([Role.ADMIN, Role.MODERATOR]);
    const sp = request.nextUrl.searchParams;
    const filters = parseFilters(sp);
    const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(5, parseInt(sp.get("pageSize") ?? "25", 10) || 25),
    );
    const sortKey = sp.get("sortKey") ?? "views";
    const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";
    const safeSort = SORT_KEYS.has(sortKey) ? sortKey : "views";

    const data = await getAnalyticsContentPerformance(filters, {
      page,
      pageSize,
      sortKey: safeSort,
      sortDir,
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("NEXT_REDIRECT")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "Insufficient permissions") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("GET /api/admin/analytics/content-performance:", error);
    return NextResponse.json(
      { error: "Failed to load content performance" },
      { status: 500 },
    );
  }
}

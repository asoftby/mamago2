import { NextRequest, NextResponse } from "next/server";
import { AnalyticsEntityType, Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/server";
import type { AnalyticsOverviewDateRange } from "@/lib/analytics/adminOverviewTypes";
import { getPublicationAnalyticsDetail } from "@/server/services/analytics/analyticsContentPerformance.service";

const DATE_RANGES: AnalyticsOverviewDateRange[] = [
  "today",
  "7d",
  "30d",
  "90d",
  "1y",
];

const ENTITY_TYPES = new Set<string>(Object.values(AnalyticsEntityType));

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  try {
    await requireRole([Role.ADMIN, Role.MODERATOR]);

    const { entityType: rawEntityType, entityId } = await params;
    const entityType = rawEntityType.toUpperCase();
    if (!ENTITY_TYPES.has(entityType) || !entityId) {
      return NextResponse.json({ error: "invalid_entity" }, { status: 400 });
    }

    const sp = request.nextUrl.searchParams;
    const dr = sp.get("dateRange") ?? "30d";
    const dateRange = DATE_RANGES.includes(dr as AnalyticsOverviewDateRange)
      ? (dr as AnalyticsOverviewDateRange)
      : "30d";
    const city = sp.get("city") ?? "";

    const data = await getPublicationAnalyticsDetail({
      entityType: entityType as AnalyticsEntityType,
      entityId,
      filters: { dateRange, city },
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
    console.error(
      "GET /api/admin/analytics/content-performance/[entityType]/[entityId]:",
      error,
    );
    return NextResponse.json(
      { error: "Failed to load publication analytics" },
      { status: 500 },
    );
  }
}

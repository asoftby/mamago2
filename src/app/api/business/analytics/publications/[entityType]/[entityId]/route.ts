/**
 * GET /api/business/analytics/publications/[entityType]/[entityId]
 *
 * Per-publication drill-down for a business's own publication — Task 3
 * Business Analytics MVP. Reuses the exact same
 * getPublicationAnalyticsDetail() aggregate (and its CTA target-action
 * labels) already built for Admin — no second implementation of rate/CTA
 * grouping.
 *
 * P0: entityId is client-supplied and MUST NOT be trusted. Every request
 * re-verifies server-side that the requested entity actually belongs to the
 * authenticated user's own business (businessOwnsPublication) before any
 * analytics query runs. A foreign or nonexistent publication returns 404
 * with zero metric leakage — never a 200 with empty/zeroed data (which
 * would itself confirm/deny existence of a foreign entity).
 */
import { NextRequest, NextResponse } from "next/server";
import { AnalyticsEntityType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { businessOwnsPublication } from "@/server/services/business/businessAnalyticsAccess";
import type { AnalyticsOverviewDateRange } from "@/lib/analytics/adminOverviewTypes";
import { getPublicationAnalyticsDetail } from "@/server/services/analytics/analyticsContentPerformance.service";

const DATE_RANGES: AnalyticsOverviewDateRange[] = [
  "today",
  "7d",
  "30d",
  "90d",
  "1y",
];

// Business Analytics MVP only covers publication types a business can own.
const BUSINESS_ENTITY_TYPES = new Set(["EVENT", "OFFER", "PLACE"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { entityType: rawEntityType, entityId } = await params;
    const entityType = rawEntityType.toUpperCase();
    if (!BUSINESS_ENTITY_TYPES.has(entityType) || !entityId) {
      return NextResponse.json({ error: "invalid_entity" }, { status: 400 });
    }

    const owns = await businessOwnsPublication({
      userId: user.id,
      businessId: business.id,
      entityType: entityType as AnalyticsEntityType,
      entityId,
    });
    if (!owns) {
      // Foreign or nonexistent publication — 404, no metric leakage.
      return NextResponse.json({ error: "Publication not found" }, { status: 404 });
    }

    const sp = request.nextUrl.searchParams;
    const dr = sp.get("dateRange") ?? "30d";
    const dateRange = DATE_RANGES.includes(dr as AnalyticsOverviewDateRange)
      ? (dr as AnalyticsOverviewDateRange)
      : "30d";

    const data = await getPublicationAnalyticsDetail({
      entityType: entityType as AnalyticsEntityType,
      entityId,
      filters: { dateRange, city: "" },
    });
    return NextResponse.json(data);
  } catch (err) {
    console.error(
      "[GET /api/business/analytics/publications/[entityType]/[entityId]]",
      err,
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/business/analytics/publications
 *
 * Full list of the current business's own publications (Event/Offer/Place)
 * with real aggregate UserEvent metrics — Task 3 Business Analytics MVP.
 * Server-side scoped to the caller's own business (getMyBusiness), same
 * pattern as /api/business/bookings/analytics. No entityId is ever accepted
 * from the client here — the list is entirely derived from ownership.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBusinessPublicationsPerformance } from "@/server/services/business/businessWorkspace.service";
import type { AnalyticsOverviewDateRange } from "@/lib/analytics/adminOverviewTypes";
import { resolveAnalyticsDateRange } from "@/server/services/analytics/analyticsDateRange";

const DATE_RANGES: AnalyticsOverviewDateRange[] = [
  "today",
  "7d",
  "30d",
  "90d",
  "1y",
];

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getMyBusiness(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const dr = request.nextUrl.searchParams.get("dateRange") ?? "30d";
    const dateRange = DATE_RANGES.includes(dr as AnalyticsOverviewDateRange)
      ? (dr as AnalyticsOverviewDateRange)
      : "30d";
    const { start, end } = resolveAnalyticsDateRange(dateRange);

    const publications = await getBusinessPublicationsPerformance({
      userId: user.id,
      businessId: business.id,
      dateRange: { start, end },
    });
    return NextResponse.json({
      publications,
      range: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (err) {
    console.error("[GET /api/business/analytics/publications]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

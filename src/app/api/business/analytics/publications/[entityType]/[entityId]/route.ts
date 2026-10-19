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
import { prisma } from "@/lib/prisma";
import {
  businessPublicationDayRange,
  businessPublicationCustomRange,
  type BusinessStatsPeriod,
} from "@/lib/business/publicationAnalyticsRange";
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

    // All new period filters are resolved server-side, after ownership checks.
    // Activity/Place have no publishedAt column; creation is the earliest
    // verifiable boundary. Offer has an explicit publishedAt when available.
    const publication = entityType === "EVENT"
      ? await prisma.activity.findUnique({ where: { id: entityId }, select: { createdAt: true } })
      : entityType === "OFFER"
        ? await prisma.offer.findUnique({ where: { id: entityId }, select: { createdAt: true, publishedAt: true } })
        : await prisma.place.findUnique({ where: { id: entityId }, select: { createdAt: true } });
    if (!publication) return NextResponse.json({ error: "Publication not found" }, { status: 404 });
    const firstAvailable: Date = "publishedAt" in publication && publication.publishedAt instanceof Date
      ? publication.publishedAt
      : publication.createdAt;

    const requestedPeriod = sp.get("period");
    const presets: BusinessStatsPeriod[] = ["today", "yesterday", "week", "month", "custom"];
    if (requestedPeriod && !presets.includes(requestedPeriod as BusinessStatsPeriod)) {
      return NextResponse.json({ error: "Неверный период" }, { status: 400 });
    }
    const now = new Date();
    const window = requestedPeriod === "custom"
      ? businessPublicationCustomRange({
          from: sp.get("from") ?? "",
          to: sp.get("to") ?? "",
          publishedAt: firstAvailable,
          now,
        })
      : requestedPeriod
        ? businessPublicationDayRange(requestedPeriod as Exclude<BusinessStatsPeriod, "custom">, now)
        : null;
    if (requestedPeriod === "custom" && !window) {
      return NextResponse.json({ error: "Проверьте выбранные даты" }, { status: 400 });
    }
    const resolvedRange = window
      ? { start: new Date(Math.max(window.start.getTime(), firstAvailable.getTime())), end: window.end }
      : null;
    // Empty but valid windows must return zeroes, not expand to lifetime.
    const boundedRange = resolvedRange && resolvedRange.start > resolvedRange.end
      ? { start: new Date(resolvedRange.end.getTime() + 1), end: resolvedRange.end }
      : resolvedRange;

    const data = await getPublicationAnalyticsDetail({
      entityType: entityType as AnalyticsEntityType,
      entityId,
      filters: { dateRange, city: "" },
      ...(boundedRange ? { rangeOverride: boundedRange } : {}),
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

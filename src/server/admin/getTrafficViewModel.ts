/**
 * /admin Traffic block data (§ modular dashboard amendment, Traffic
 * telemetry completion).
 *
 * TRAFFIC DATA AUDIT:
 *
 *   - "Unique visitors" and "page views" are now real, backed by the
 *     `PAGE_VIEW` UserEvent written by `PageViewTracker`
 *     (src/components/analytics/PageViewTracker.tsx), mounted once in the
 *     public shell (`(public)/PublicLayoutBody.tsx`). A visitor is a
 *     session that generated at least one PAGE_VIEW in the window — plain
 *     background telemetry (CARD_VIEW, CTA_CLICK, ...) does NOT make a
 *     session count as a visitor here. This is a deliberate narrower
 *     definition than /admin/performance's `trackedVisitors` (which counts
 *     DISTINCT sessionId over ALL UserEvent types).
 *   - "Region distribution" (`regions`) remains a GAP. The trusted-IP
 *     question is now resolved: the live Traefik contract is verified
 *     (`forwardedHeaders.trustedIPs` empty, no CDN in front — only
 *     `X-Real-IP` is trustworthy, gated behind `TRUST_PROXY_HEADERS`; see
 *     `getTrustedClientIp()` in `@/lib/security/clientIp`) and every
 *     spoofable-header reader in the app has been migrated to it. What's
 *     still missing is (a) a local GeoIP source — no `maxmind`/`.mmdb` in
 *     this repo yet, a real new deploy-infra decision — and (b) actually
 *     flipping `TRUST_PROXY_HEADERS=true` on the live hosts, which is a
 *     deployment step outside this repo. Do not populate `regions` until
 *     both are done and approved.
 *
 * Today-vs-yesterday uses `resolveElapsedTodayVsYesterday()` — elapsed
 * "today so far" against the exact same elapsed duration yesterday, never
 * partial-today against full-yesterday. Applied to both unique visitors
 * and page views.
 */
import type { PrismaClient } from "@prisma/client";
import { comparisonPercent } from "@/lib/performance/performanceMetrics";
import { resolveElapsedTodayVsYesterday } from "@/lib/admin/trafficWindow";

export interface TrafficViewModel {
  /** null only if the underlying query itself failed — a successful query always yields a real number, including a true 0. */
  uniqueVisitorsToday: number | null;
  uniqueVisitorsYesterday: number | null;
  /** null when yesterday's count is 0 or unknown — never a fabricated infinite/undefined percentage. */
  visitorsDeltaPercent: number | null;
  pageViewsToday: number | null;
  pageViewsYesterday: number | null;
  pageViewsDeltaPercent: number | null;
  /** null when uniqueVisitorsToday is 0 — UI must render "—", never 0/Infinity/NaN. */
  pageViewsPerVisitor: number | null;
  /** GAP: blocked on trusted-IP host verification + GeoIP source, see file header. */
  regions: null;
}

export const EMPTY_TRAFFIC_VIEW_MODEL: TrafficViewModel = {
  uniqueVisitorsToday: null,
  uniqueVisitorsYesterday: null,
  visitorsDeltaPercent: null,
  pageViewsToday: null,
  pageViewsYesterday: null,
  pageViewsDeltaPercent: null,
  pageViewsPerVisitor: null,
  regions: null,
};

interface CountRow {
  count: bigint;
}

async function countDistinctPageViewSessions(prisma: PrismaClient, start: Date, end: Date): Promise<number> {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(DISTINCT "sessionId")::bigint AS count
    FROM "UserEvent"
    WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
      AND "eventType" = 'PAGE_VIEW' AND "sessionId" IS NOT NULL
  `;
  return Number(rows[0]?.count ?? 0);
}

async function countPageViews(prisma: PrismaClient, start: Date, end: Date): Promise<number> {
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "UserEvent"
    WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
      AND "eventType" = 'PAGE_VIEW'
  `;
  return Number(rows[0]?.count ?? 0);
}

function computePageViewsPerVisitor(pageViews: number, uniqueVisitors: number): number | null {
  if (uniqueVisitors <= 0) return null;
  return Math.round((pageViews / uniqueVisitors) * 10) / 10;
}

export async function getTrafficViewModel(prisma: PrismaClient, now: Date): Promise<TrafficViewModel> {
  const window = resolveElapsedTodayVsYesterday(now);

  const [uniqueVisitorsToday, uniqueVisitorsYesterday, pageViewsToday, pageViewsYesterday] = await Promise.all([
    countDistinctPageViewSessions(prisma, window.todayStart, window.todayEnd),
    countDistinctPageViewSessions(prisma, window.yesterdayStart, window.yesterdayEnd),
    countPageViews(prisma, window.todayStart, window.todayEnd),
    countPageViews(prisma, window.yesterdayStart, window.yesterdayEnd),
  ]);

  return {
    uniqueVisitorsToday,
    uniqueVisitorsYesterday,
    visitorsDeltaPercent: comparisonPercent(uniqueVisitorsToday, uniqueVisitorsYesterday),
    pageViewsToday,
    pageViewsYesterday,
    pageViewsDeltaPercent: comparisonPercent(pageViewsToday, pageViewsYesterday),
    pageViewsPerVisitor: computePageViewsPerVisitor(pageViewsToday, uniqueVisitorsToday),
    regions: null,
  };
}

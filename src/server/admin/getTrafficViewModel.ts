/**
 * /admin Traffic block data (§ modular dashboard amendment, Traffic
 * telemetry completion).
 *
 * TRAFFIC DATA AUDIT:
 *
 *   - "Unique visitors" and "page views" are now real, backed by the
 *     `PAGE_VIEW` UserEvent written by `PageViewTracker`
 *     (src/components/analytics/PageViewTracker.tsx), mounted once in the
 *     public shell (`(public)/PublicLayoutBody.tsx`). "Unique visitors" is
 *     the canonical audience identity (see
 *     `@/server/services/analytics/canonicalAudience`) over PAGE_VIEW rows
 *     in the window — the SAME identity `audience.dau`/`wau`/`mau` and
 *     /admin/performance's `trackedVisitors` now use, so
 *     `uniqueVisitorsToday` and `audience.dau` agree for the same window.
 *     "Page views" stays a plain row count, not role-filtered.
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
import { computeCanonicalAudience } from "@/server/services/analytics/canonicalAudience";

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

  const [audienceToday, audienceYesterday, pageViewsToday, pageViewsYesterday] = await Promise.all([
    computeCanonicalAudience(prisma, window.todayStart, window.todayEnd),
    computeCanonicalAudience(prisma, window.yesterdayStart, window.yesterdayEnd),
    countPageViews(prisma, window.todayStart, window.todayEnd),
    countPageViews(prisma, window.yesterdayStart, window.yesterdayEnd),
  ]);
  const uniqueVisitorsToday = audienceToday.visitors;
  const uniqueVisitorsYesterday = audienceYesterday.visitors;

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

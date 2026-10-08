/**
 * MetricSample -> snapshot projection (§21 Step 5, Phase N).
 *
 * The admin read path never scans MetricSample. Projection runs only in the
 * async worker that materializes OperationsSnapshot.
 *
 * A missing sample projects to `null`, never 0 — a collector that hasn't
 * run yet (or whose last run failed) must not be indistinguishable from a
 * genuinely observed zero.
 */
import type { PrismaClient } from "@prisma/client";
import { format } from "date-fns";

async function latestMetricValue(prisma: PrismaClient, metric: string, dimKey = ""): Promise<number | null> {
  const row = await prisma.metricSample.findFirst({
    where: { metric, dimKey },
    orderBy: { collectedAt: "desc" },
    select: { value: true },
  });
  return row ? row.value : null;
}

async function latestMetricSample(
  prisma: PrismaClient,
  metric: string,
): Promise<{ dimKey: string; value: number } | null> {
  const row = await prisma.metricSample.findFirst({
    where: { metric },
    orderBy: { collectedAt: "desc" },
    select: { dimKey: true, value: true },
  });
  return row ?? null;
}

export interface ModerationQueueProjection {
  size: number | null;
  oldestAgeSec: number | null;
}

export interface OperationsQueuesProjection {
  moderation: {
    place: ModerationQueueProjection;
    place_revision: ModerationQueueProjection;
    event: ModerationQueueProjection;
    offer: ModerationQueueProjection;
  };
  import: {
    reviewSize: number | null;
    failedSources: number | null;
  };
  b2b: {
    pendingSize: number | null;
  };
}

const MODERATION_QUEUE_KEYS = ["place", "place_revision", "event", "offer"] as const;

async function projectModerationQueues(prisma: PrismaClient): Promise<OperationsQueuesProjection["moderation"]> {
  const entries = await Promise.all(
    MODERATION_QUEUE_KEYS.map(async (key) => {
      const [size, oldestAgeSec] = await Promise.all([
        latestMetricValue(prisma, "queue.moderation.size", key),
        latestMetricValue(prisma, "queue.moderation.oldest_age_sec", key),
      ]);
      return [key, { size, oldestAgeSec }] as const;
    }),
  );
  return Object.fromEntries(entries) as OperationsQueuesProjection["moderation"];
}

export async function projectOperationsQueues(prisma: PrismaClient): Promise<OperationsQueuesProjection> {
  const [moderation, reviewSize, failedSources, pendingSize] = await Promise.all([
    projectModerationQueues(prisma),
    latestMetricValue(prisma, "queue.import.review_size"),
    latestMetricValue(prisma, "import.failed_sources"),
    latestMetricValue(prisma, "queue.b2b.pending_size"),
  ]);

  return {
    moderation,
    import: { reviewSize, failedSources },
    b2b: { pendingSize },
  };
}

/** Global-dimKey (dimKey="") KPI metric names projected onto the snapshot's `kpis` field. */
const KPI_METRIC_NAMES = [
  "db.latency_ms",
  "db.connection_capacity_pct",
  "comms.failed_deliveries_1h",
  "audience.dau",
  "audience.wau",
  "audience.wau_prev",
  "audience.mau",
  "audience.mau_prev",
  "search.queries_total",
  "search.zero_result_rate",
  "search.action_rate",
  "funnel.content_opens",
  "funnel.saves",
  "funnel.plan_adds",
  "funnel.cta_clicks",
  "telemetry.events_written_5m",
  "planning.wpf",
  "planning.wpf_prev",
  "retention.w1",
  "retention.w1_prev",
  "retention.w4",
  "retention.w4_prev",
  "habit.3of4week",
  "habit.3of4week_prev",
  "funnel.engaged_users",
  "funnel.save_rate",
  "funnel.plan_rate",
  "funnel.cta_rate",
  "supply.active_events",
  "supply.active_places",
  "supply.active_offers",
  "supply.content_freshness_pct",
  "b2b.active_businesses",
  "b2b.new_businesses_30d",
  "b2b.meaningful_action_rate",
  // Google Search Console MVP — two complete 7-day windows.
  "gsc.clicks_7d",
  "gsc.clicks_prev_7d",
  "gsc.impressions_7d",
  "gsc.impressions_prev_7d",
  "gsc.ctr_7d",
  "gsc.ctr_prev_7d",
  "gsc.position_7d",
  "gsc.position_prev_7d",
] as const;

export interface GscPageMoverProjection {
  page: string;
  deltaClicks: number;
}

async function projectGscPageMovers(prisma: PrismaClient): Promise<{
  rising: GscPageMoverProjection[];
  falling: GscPageMoverProjection[];
}> {
  const [rise1, rise2, rise3, fall1, fall2, fall3] = await Promise.all([
    latestMetricSample(prisma, "gsc.page.rise.1"),
    latestMetricSample(prisma, "gsc.page.rise.2"),
    latestMetricSample(prisma, "gsc.page.rise.3"),
    latestMetricSample(prisma, "gsc.page.fall.1"),
    latestMetricSample(prisma, "gsc.page.fall.2"),
    latestMetricSample(prisma, "gsc.page.fall.3"),
  ]);
  const toMover = (row: { dimKey: string; value: number } | null): GscPageMoverProjection | null =>
    row && row.dimKey ? { page: row.dimKey, deltaClicks: row.value } : null;
  return {
    rising: [rise1, rise2, rise3].map(toMover).filter((row): row is GscPageMoverProjection => row !== null),
    falling: [fall1, fall2, fall3].map(toMover).filter((row): row is GscPageMoverProjection => row !== null),
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DASHBOARD_TIME_ZONE = "Europe/Minsk";

/**
 * Latest value per dimKey for a dimensioned metric (e.g. one sample per ISO
 * week), limited to samples collected since `since`. Later collections of the
 * same dimKey (a re-computed week) win.
 */
async function latestValuesByDimKey(
  prisma: PrismaClient,
  metric: string,
  since: Date,
): Promise<Record<string, number>> {
  const rows = await prisma.metricSample.findMany({
    where: { metric, collectedAt: { gte: since }, NOT: { dimKey: "" } },
    orderBy: { collectedAt: "asc" },
    select: { dimKey: true, value: true },
  });
  const result: Record<string, number> = {};
  for (const row of rows) result[row.dimKey] = row.value;
  return result;
}

/** ISO week label ("2026-W39") of an instant, in the dashboard's time zone. */
export function isoWeekInTimeZone(instant: Date, timeZone = DASHBOARD_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const v = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return format(new Date(Number(v.year), Number(v.month) - 1, Number(v.day), 12), "RRRR-'W'II");
}

export interface WeeklyHistoryPoint {
  isoWeek: string;
  value: number;
}

/**
 * For a rolling global metric (e.g. WAU = trailing 7 days), the value as last
 * observed in each ISO week — i.e. the week-end reading, and "so far" for the
 * current week. Weeks without any sample are absent, never 0.
 */
export function bucketLastValuePerWeek(
  rows: readonly { collectedAt: Date; value: number }[],
  timeZone = DASHBOARD_TIME_ZONE,
): WeeklyHistoryPoint[] {
  const byWeek = new Map<string, number>();
  for (const row of [...rows].sort((a, b) => a.collectedAt.getTime() - b.collectedAt.getTime())) {
    byWeek.set(isoWeekInTimeZone(row.collectedAt, timeZone), row.value);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([isoWeek, value]) => ({ isoWeek, value }));
}

async function weeklyHistory(
  prisma: PrismaClient,
  metric: string,
  now: Date,
  weeks: number,
): Promise<WeeklyHistoryPoint[]> {
  const rows = await prisma.metricSample.findMany({
    where: { metric, dimKey: "", collectedAt: { gte: new Date(now.getTime() - weeks * WEEK_MS) } },
    select: { collectedAt: true, value: true },
  });
  return bucketLastValuePerWeek(rows).slice(-weeks);
}

export async function projectOperationsKpis(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<Record<string, unknown>> {
  const since = new Date(now.getTime() - 16 * WEEK_MS);
  const [entries, pageMovers, evergreenWeekly, totalWeekly, wauWeekly, wpfWeekly] = await Promise.all([
    Promise.all(KPI_METRIC_NAMES.map(async (metric) => [metric, await latestMetricValue(prisma, metric)] as const)),
    projectGscPageMovers(prisma),
    latestValuesByDimKey(prisma, "seo.evergreen_clicks_weekly", since),
    latestValuesByDimKey(prisma, "seo.total_clicks_weekly", since),
    weeklyHistory(prisma, "audience.wau", now, 8),
    weeklyHistory(prisma, "planning.wpf", now, 8),
  ]);
  return {
    ...Object.fromEntries(entries),
    "gsc.page_movers": pageMovers,
    "seo.evergreen_weekly": evergreenWeekly,
    "seo.total_weekly": totalWeekly,
    "audience.wau_weekly": wauWeekly,
    "planning.wpf_weekly": wpfWeekly,
  };
}

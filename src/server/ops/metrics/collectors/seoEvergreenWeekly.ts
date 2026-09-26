/**
 * seo.evergreen_clicks_weekly / seo.total_clicks_weekly — every 12h.
 *
 * Feeds the dashboard's organic-recovery block with the SAME metric the
 * locked recovery gate is defined on (config/seo-baseline.ts): evergreen
 * clicks per completed ISO week, classified by lib/seo/urlClass.ts
 * (event and unclear URLs excluded). Replaces hand-maintaining
 * `actualEvergreenByIsoWeek` in the config.
 *
 * One sample per ISO week, dimKey = "2026-W38". Only fully completed weeks
 * (Monday..Sunday, with the Sunday inside GSC's 3-day data lag) are
 * written, and only weeks from the gate's measurement start onward. A week
 * for which GSC returns no page rows is skipped — never written as 0.
 *
 * GSC Search Analytics dates are Pacific Time; ISO weeks here are PT
 * calendar weeks, matching how the baseline itself was computed.
 */
import { addDays, format, isValid, parse, startOfISOWeek } from "date-fns";

import { SEO_BASELINE } from "../../../../../config/seo-baseline";
import { getEvergreenClicks } from "../../../../../lib/seo/baseline";
import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";
import {
  DATA_LAG_DAYS,
  getAccessToken,
  ptDateYmd,
  querySearchAnalytics,
  resolveGoogleSearchConsoleConfig,
  shiftYmd,
  type GscConfig,
  type GscRow,
} from "./googleSearchConsole";

const ISO_WEEK_FORMAT = "RRRR-'W'II";
const ISO_WEEK_REFERENCE = new Date(2000, 0, 3, 12, 0, 0);
const MAX_WEEKS = 12;
const PAGE_ROW_LIMIT = 25_000;
const MAX_PAGE_REQUESTS_PER_WEEK = 8;

export interface CompletedIsoWeek {
  isoWeek: string;
  startDate: string;
  endDate: string;
}

function ymdToNoon(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function isoWeekStart(isoWeek: string): Date | null {
  const parsed = parse(isoWeek, ISO_WEEK_FORMAT, ISO_WEEK_REFERENCE);
  if (!isValid(parsed)) return null;
  const start = startOfISOWeek(parsed);
  return format(start, ISO_WEEK_FORMAT) === isoWeek ? start : null;
}

/**
 * Completed ISO weeks from `fromIsoWeek` through the last week whose Sunday
 * is inside the available GSC data (`today PT − DATA_LAG_DAYS`), capped to
 * the most recent MAX_WEEKS.
 */
export function completedIsoWeeksSince(now: Date, fromIsoWeek: string, maxWeeks = MAX_WEEKS): CompletedIsoWeek[] {
  const dataThrough = ymdToNoon(shiftYmd(ptDateYmd(now), -DATA_LAG_DAYS));
  const first = isoWeekStart(fromIsoWeek);
  if (!first) return [];

  const weeks: CompletedIsoWeek[] = [];
  for (let start = first; ; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    if (end > dataThrough) break;
    weeks.push({ isoWeek: format(start, ISO_WEEK_FORMAT), startDate: toYmd(start), endDate: toYmd(end) });
    if (weeks.length > 200) break;
  }
  return weeks.slice(-maxWeeks);
}

async function queryAllPages(config: GscConfig, accessToken: string, week: CompletedIsoWeek): Promise<GscRow[]> {
  const rows: GscRow[] = [];
  for (let request = 0; request < MAX_PAGE_REQUESTS_PER_WEEK; request += 1) {
    const batch = await querySearchAnalytics(
      config,
      accessToken,
      { startDate: week.startDate, endDate: week.endDate },
      ["page"],
      PAGE_ROW_LIMIT,
      request * PAGE_ROW_LIMIT,
    );
    rows.push(...batch);
    if (batch.length < PAGE_ROW_LIMIT) return rows;
  }
  throw new Error(`GSC page rows for ${week.isoWeek} exceed ${MAX_PAGE_REQUESTS_PER_WEEK * PAGE_ROW_LIMIT}`);
}

/** Pure: evergreen + total clicks for one week's page rows; null when GSC returned no rows. */
export function weeklyClicksFromPageRows(
  isoWeek: string,
  rows: readonly GscRow[],
): { evergreen: number; total: number } | null {
  const pageRows = rows.flatMap((row) => {
    const url = row.keys?.[0];
    return url ? [{ isoWeek, url, clicks: row.clicks }] : [];
  });
  const evergreen = getEvergreenClicks(pageRows, isoWeek);
  if (evergreen === null) return null;
  const total = pageRows.reduce((sum, row) => sum + row.clicks, 0);
  return { evergreen, total };
}

export async function collectSeoEvergreenWeekly(ctx: MetricCollectorContext): Promise<MetricSampleDraft[]> {
  const config = resolveGoogleSearchConsoleConfig();
  if (!config) return [];

  const weeks = completedIsoWeeksSince(ctx.now, SEO_BASELINE.measurementStartIsoWeek);
  if (weeks.length === 0) return [];

  const accessToken = await getAccessToken(config, ctx.now);
  const samples: MetricSampleDraft[] = [];
  // Sequential on purpose: at most MAX_WEEKS small requests every 12h, well
  // inside the Search Analytics per-minute quota.
  for (const week of weeks) {
    const rows = await queryAllPages(config, accessToken, week);
    const clicks = weeklyClicksFromPageRows(week.isoWeek, rows);
    if (!clicks) continue;
    samples.push(
      { metric: "seo.evergreen_clicks_weekly", dimKey: week.isoWeek, value: clicks.evergreen },
      { metric: "seo.total_clicks_weekly", dimKey: week.isoWeek, value: clicks.total },
    );
  }
  return samples;
}

export const seoEvergreenWeeklyCollector: MetricCollector = {
  name: "seo_evergreen_weekly",
  intervalSec: 12 * 60 * 60,
  timeoutMs: 120_000,
  collect: collectSeoEvergreenWeekly,
};

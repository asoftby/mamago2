import { createHash, createSign } from "node:crypto";

import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEARCH_ANALYTICS_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SEARCH_ANALYTICS_BASE = "https://www.googleapis.com/webmasters/v3/sites";
const DATA_LAG_DAYS = 3;
const DETAIL_ROW_LIMIT = 50;
const DETAIL_SAMPLES_PER_DIMENSION = 20;
const MOVERS_LIMIT = 3;
const MAX_DIM_KEY_LENGTH = 128;

interface GscConfig {
  siteUrl: string;
  clientEmail: string;
  privateKey: string;
}

interface GscRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscResponse {
  rows?: GscRow[];
}

interface DateRange {
  startDate: string;
  endDate: string;
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function resolveGoogleSearchConsoleConfig(
  env: Record<string, string | undefined> = process.env,
): GscConfig | null {
  if (!enabled(env.GOOGLE_SEARCH_CONSOLE_ENABLED)) return null;

  const siteUrl = env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() ?? "";
  const clientEmail = env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL?.trim() ?? "";
  const privateKey = (env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();

  const validSite = siteUrl.startsWith("sc-domain:") || /^https?:\/\//i.test(siteUrl);
  const validEmail = clientEmail.includes("@");
  const validKey = privateKey.includes("BEGIN PRIVATE KEY") && privateKey.includes("END PRIVATE KEY");

  if (!validSite || !validEmail || !validKey) return null;
  return { siteUrl, clientEmail, privateKey };
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function buildServiceAccountAssertion(config: GscConfig, now: Date): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: config.clientEmail,
    scope: SEARCH_ANALYTICS_SCOPE,
    aud: TOKEN_URL,
    iat,
    exp: iat + 3600,
  });
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(config.privateKey, "base64url")}`;
}

async function getAccessToken(config: GscConfig, now: Date): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: buildServiceAccountAssertion(config, now),
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`GSC OAuth failed with HTTP ${response.status}`);
  }
  const json = (await response.json()) as { access_token?: unknown };
  if (typeof json.access_token !== "string" || !json.access_token) {
    throw new Error("GSC OAuth response did not contain an access token");
  }
  return json.access_token;
}

async function querySearchAnalytics(
  config: GscConfig,
  accessToken: string,
  range: DateRange,
  dimensions: string[] = [],
  rowLimit = 1,
): Promise<GscRow[]> {
  const endpoint = `${SEARCH_ANALYTICS_BASE}/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...range,
      ...(dimensions.length ? { dimensions } : {}),
      type: "web",
      rowLimit,
    }),
  });
  if (!response.ok) {
    throw new Error(`GSC Search Analytics failed with HTTP ${response.status}`);
  }
  const json = (await response.json()) as GscResponse;
  return Array.isArray(json.rows) ? json.rows.filter(validRow) : [];
}

function validRow(row: GscRow): boolean {
  return [row.clicks, row.impressions, row.ctr, row.position].every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
}

function ptDateYmd(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function searchConsoleComparisonRanges(now: Date): { current: DateRange; previous: DateRange } {
  const todayPt = ptDateYmd(now);
  const endDate = shiftYmd(todayPt, -DATA_LAG_DAYS);
  const startDate = shiftYmd(endDate, -6);
  const previousEndDate = shiftYmd(startDate, -1);
  const previousStartDate = shiftYmd(previousEndDate, -6);
  return {
    current: { startDate, endDate },
    previous: { startDate: previousStartDate, endDate: previousEndDate },
  };
}

function compactDimension(raw: string, kind: "page" | "query"): string {
  let value = raw.trim();
  if (kind === "page") {
    try {
      const url = new URL(value);
      value = `${url.pathname}${url.search}` || "/";
    } catch {
      // Keep the raw key from GSC if a URL-prefix property ever returns a non-URL key.
    }
  }
  if (value.length <= MAX_DIM_KEY_LENGTH) return value;
  const hash = createHash("sha1").update(value).digest("hex").slice(0, 8);
  return `${value.slice(0, MAX_DIM_KEY_LENGTH - 9)}…${hash}`;
}

function aggregateRow(rows: GscRow[]): GscRow {
  return rows[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
}

function metricRows(prefix: string, kind: "page" | "query", rows: GscRow[]): MetricSampleDraft[] {
  const seen = new Set<string>();
  const samples: MetricSampleDraft[] = [];
  for (const row of rows.slice(0, DETAIL_SAMPLES_PER_DIMENSION)) {
    const rawKey = row.keys?.[0];
    if (!rawKey) continue;
    const dimKey = compactDimension(rawKey, kind);
    if (!dimKey || seen.has(dimKey)) continue;
    seen.add(dimKey);
    samples.push(
      { metric: `${prefix}.clicks`, dimKey, value: row.clicks },
      { metric: `${prefix}.impressions`, dimKey, value: row.impressions },
      { metric: `${prefix}.ctr`, dimKey, value: row.ctr },
      { metric: `${prefix}.position`, dimKey, value: row.position },
    );
  }
  return samples;
}

export function pageClickMovers(currentRows: GscRow[], previousRows: GscRow[]) {
  const current = new Map<string, number>();
  const previous = new Map<string, number>();
  for (const row of currentRows) {
    const key = row.keys?.[0];
    if (key) current.set(key, row.clicks);
  }
  for (const row of previousRows) {
    const key = row.keys?.[0];
    if (key) previous.set(key, row.clicks);
  }

  const keys = new Set([...current.keys(), ...previous.keys()]);
  const deltas = [...keys].map((page) => ({
    page,
    delta: (current.get(page) ?? 0) - (previous.get(page) ?? 0),
  }));
  return {
    rising: deltas.filter((item) => item.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, MOVERS_LIMIT),
    falling: deltas.filter((item) => item.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, MOVERS_LIMIT),
  };
}

function moverSamples(currentRows: GscRow[], previousRows: GscRow[]): MetricSampleDraft[] {
  const movers = pageClickMovers(currentRows, previousRows);
  const samples: MetricSampleDraft[] = [];
  for (const [direction, rows] of [
    ["rise", movers.rising],
    ["fall", movers.falling],
  ] as const) {
    for (let index = 0; index < MOVERS_LIMIT; index += 1) {
      const item = rows[index];
      samples.push({
        metric: `gsc.page.${direction}.${index + 1}`,
        dimKey: item ? compactDimension(item.page, "page") : "",
        value: item?.delta ?? 0,
      });
    }
  }
  return samples;
}

export async function collectGoogleSearchConsoleMetrics(
  ctx: MetricCollectorContext,
): Promise<MetricSampleDraft[]> {
  const config = resolveGoogleSearchConsoleConfig();
  if (!config) return [];

  const accessToken = await getAccessToken(config, ctx.now);
  const ranges = searchConsoleComparisonRanges(ctx.now);
  const [currentAggregateRows, previousAggregateRows, currentPages, previousPages, currentQueries] = await Promise.all([
    querySearchAnalytics(config, accessToken, ranges.current),
    querySearchAnalytics(config, accessToken, ranges.previous),
    querySearchAnalytics(config, accessToken, ranges.current, ["page"], DETAIL_ROW_LIMIT),
    querySearchAnalytics(config, accessToken, ranges.previous, ["page"], DETAIL_ROW_LIMIT),
    querySearchAnalytics(config, accessToken, ranges.current, ["query"], DETAIL_ROW_LIMIT),
  ]);

  const current = aggregateRow(currentAggregateRows);
  const previous = aggregateRow(previousAggregateRows);
  return [
    { metric: "gsc.clicks_7d", value: current.clicks },
    { metric: "gsc.clicks_prev_7d", value: previous.clicks },
    { metric: "gsc.impressions_7d", value: current.impressions },
    { metric: "gsc.impressions_prev_7d", value: previous.impressions },
    { metric: "gsc.ctr_7d", value: current.ctr },
    { metric: "gsc.ctr_prev_7d", value: previous.ctr },
    { metric: "gsc.position_7d", value: current.position },
    { metric: "gsc.position_prev_7d", value: previous.position },
    ...metricRows("gsc.page", "page", currentPages),
    ...metricRows("gsc.query", "query", currentQueries),
    ...moverSamples(currentPages, previousPages),
  ];
}

export const googleSearchConsoleCollector: MetricCollector = {
  name: "google_search_console",
  intervalSec: 6 * 60 * 60,
  timeoutMs: 30_000,
  collect: collectGoogleSearchConsoleMetrics,
};

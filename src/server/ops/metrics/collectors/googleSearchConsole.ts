import { createHash, createSign } from "node:crypto";

import type { PrismaClient, Prisma } from "@prisma/client";

import type { MetricCollector, MetricCollectorContext, MetricSampleDraft } from "../types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEARCH_ANALYTICS_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const SEARCH_ANALYTICS_BASE = "https://www.googleapis.com/webmasters/v3/sites";
export const DATA_LAG_DAYS = 3;
const DETAIL_ROW_LIMIT = 50;
const DETAIL_SAMPLES_PER_DIMENSION = 20;
const MOVERS_LIMIT = 3;
const MAX_DIM_KEY_LENGTH = 128;

export interface GscConfig {
  siteUrl: string;
  clientEmail: string;
  privateKey: string;
  cache?: PrismaClient["gscQueryCache"];
  deadline?: number;
}

export interface GscRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GscResponse {
  rows?: GscRow[];
}

export interface DateRange {
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

  const validSite = validProperty(siteUrl);
  const validEmail = clientEmail.includes("@");
  const validKey = privateKey.includes("BEGIN PRIVATE KEY") && privateKey.includes("END PRIVATE KEY");

  if (!validSite || !validEmail || !validKey) throw new Error("GSC enabled but configuration is invalid");
  return { siteUrl, clientEmail, privateKey };
}

export function validProperty(value: string): boolean {
  if (/^sc-domain:[a-z0-9]+(?:[.-][a-z0-9]+)*$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}

/** Bounded retries; never include upstream response bodies, JWTs or keys in errors. */
export async function gscRequest(
  url: string, init: RequestInit, deadline = Date.now() + 25_000,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("GSC request deadline exceeded");
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(Math.min(8_000, remaining)) });
    } catch {
      if (attempt === 2) throw new Error("GSC network request failed");
      await sleep(250 * 2 ** attempt);
      continue;
    }
    if (response.ok) {
      try { return await response.json(); } catch { throw new Error("GSC returned invalid JSON"); }
    }
    let quota = false;
    if (response.status === 403) {
      try {
        const error = await response.json() as { error?: { errors?: { reason?: string }[] } };
        quota = error.error?.errors?.some(({ reason }) => ["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"].includes(reason ?? "")) ?? false;
      } catch { /* A non-JSON 403 is permanent. */ }
    }
    if (attempt === 2 || !(quota || response.status === 429 || response.status >= 500)) {
      throw new Error(`GSC request failed with HTTP ${response.status}`);
    }
    const retryAfter = response.headers.get("retry-after");
    const delay = retryAfter === null ? 250 * 2 ** attempt + Math.random() * 250
      : /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now());
    if (!Number.isFinite(delay) || delay > 10_000 || Date.now() + delay >= deadline) {
      throw new Error(`GSC quota/backoff deferred (HTTP ${response.status})`);
    }
    await sleep(delay);
  }
  throw new Error("GSC retries exhausted");
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

export async function getAccessToken(config: GscConfig, now: Date): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: buildServiceAccountAssertion(config, now),
  });
  const json = await gscRequest(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  }, config.deadline) as { access_token?: unknown };
  // Token is kept only for this collection; never persisted.
  if (!json || typeof json.access_token !== "string" || !json.access_token) {
    throw new Error("GSC OAuth response did not contain an access token");
  }
  return json.access_token;
}

export async function querySearchAnalytics(
  config: GscConfig,
  accessToken: string,
  range: DateRange,
  dimensions: string[] = [],
  rowLimit = 1,
  startRow = 0,
): Promise<GscRow[]> {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validProperty(config.siteUrl) || !validDate(range.startDate) || !validDate(range.endDate)
    || range.startDate > range.endDate || !Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > 25_000
    || !Number.isInteger(startRow) || startRow < 0 || dimensions.some((d) => !["page", "query", "date"].includes(d))) {
    throw new Error("Invalid GSC query parameters");
  }
  const body = { ...range, dimensions, type: "web", dataState: "final", rowLimit, startRow };
  const id = createHash("sha256").update(JSON.stringify([config.siteUrl, body])).digest("hex");
  const cached = await config.cache?.findUnique({ where: { id } });
  if (cached && cached.expiresAt.getTime() > Date.now()) return cached.rows as unknown as GscRow[];
  const endpoint = `${SEARCH_ANALYTICS_BASE}/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`;
  const json = await gscRequest(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  }, config.deadline) as GscResponse;
  if (!json || typeof json !== "object" || (json.rows !== undefined && (!Array.isArray(json.rows)
    || !json.rows.every((row) => validRow(row) && (dimensions.length === 0
      || (Array.isArray(row.keys) && row.keys.length === dimensions.length && row.keys.every((key) => typeof key === "string"))))))) {
    throw new Error("GSC returned malformed analytics rows");
  }
  const rows = json.rows ?? [];
  // Empty aggregate is unknown, and must be retried next cycle rather than cached.
  if (config.cache && (dimensions.length > 0 || rows.length > 0)) {
    const old = range.endDate < shiftYmd(ptDateYmd(new Date()), -10);
    const expiresAt = new Date(Date.now() + (old ? 7 * 24 : 6) * 3600_000);
    const data = { property: config.siteUrl, startDate: range.startDate, endDate: range.endDate,
      rows: rows as unknown as Prisma.InputJsonValue, expiresAt };
    await config.cache.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  return rows;
}

function validRow(row: GscRow): boolean {
  return !!row && typeof row === "object" && [row.clicks, row.impressions, row.ctr, row.position].every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
}

export function ptDateYmd(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftYmd(ymd: string, days: number): string {
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

/**
 * An aggregate (no-dimension) query with no rows means GSC has no finished
 * data for that window yet — not that the site had zero clicks. Fail the
 * cycle instead of writing a fabricated 0 that the dashboard would render
 * as a traffic collapse; the previous values stay projected.
 */
export function aggregateRow(rows: GscRow[], window: string): GscRow {
  const row = rows[0];
  if (!row) throw new Error(`GSC returned no aggregate row for the ${window} window`);
  return row;
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

  // Search Analytics rows are capped. Absence from one top-N response does
  // not mean zero clicks, so only compare pages whose values are known in
  // both periods. This intentionally favors correctness over completeness.
  const deltas = [...current.entries()].flatMap(([page, currentClicks]) => {
    const previousClicks = previous.get(page);
    return previousClicks === undefined ? [] : [{ page, delta: currentClicks - previousClicks }];
  });
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
  const resolved = resolveGoogleSearchConsoleConfig();
  if (!resolved) return [];
  const config = { ...resolved, cache: ctx.prisma.gscQueryCache, deadline: Date.now() + 110_000 };
  await config.cache.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 30 * 86400_000) } } });

  const accessToken = await getAccessToken(config, ctx.now);
  const ranges = searchConsoleComparisonRanges(ctx.now);
  const current = await dailyAggregate(config, accessToken, ranges.current);
  const previous = await dailyAggregate(config, accessToken, ranges.previous);
  // Sequential requests bound quota usage; page/query totals retain Google's window semantics.
  const currentPages = await querySearchAnalytics(config, accessToken, ranges.current, ["page"], DETAIL_ROW_LIMIT);
  const previousPages = await querySearchAnalytics(config, accessToken, ranges.previous, ["page"], DETAIL_ROW_LIMIT);
  const currentQueries = await querySearchAnalytics(config, accessToken, ranges.current, ["query"], DETAIL_ROW_LIMIT);

  return [
    { metric: "gsc.property", dimKey: gscPropertyKey(config.siteUrl), value: 1 },
    { metric: "gsc.data_through", dimKey: ranges.current.endDate, value: 1 },
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

export async function dailyAggregate(config: GscConfig, token: string, range: DateRange): Promise<GscRow> {
  const span = (Date.parse(range.endDate) - Date.parse(range.startDate)) / 86400_000;
  if (!Number.isFinite(span) || span < 0 || span > 30) throw new Error("Invalid GSC aggregate range");
  let clicks = 0, impressions = 0, weightedPosition = 0;
  for (let day = range.startDate; day <= range.endDate; day = shiftYmd(day, 1)) {
    const rows = await querySearchAnalytics(config, token, { startDate: day, endDate: day });
    // GSC omits days with no data. Ask for the authoritative window instead
    // of inventing a daily zero or blocking a low-traffic property forever.
    if (!rows.length && range.startDate !== range.endDate) {
      return aggregateRow(await querySearchAnalytics(config, token, range), "comparison");
    }
    const row = aggregateRow(rows, day);
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPosition / impressions : 0 };
}

export const googleSearchConsoleCollector: MetricCollector = {
  name: "google_search_console",
  intervalSec: 6 * 60 * 60,
  timeoutMs: 120_000,
  collect: collectGoogleSearchConsoleMetrics,
};

export function gscPropertyKey(property: string): string {
  return createHash("sha256").update(property).digest("hex");
}

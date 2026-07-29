/**
 * Bounded, read-only prelaunch SEO verifier.
 *
 * Crawls a running instance's sitemap.xml plus a sample of legacy-redirect
 * sources and city-duplicate probes, and checks canonical/robots/JSON-LD/
 * redirect-chain invariants. No writes, no external dependencies beyond
 * Node's built-in fetch, deterministic ordering, bounded concurrency.
 *
 * Usage:
 *   npx tsx scripts/verify-prelaunch-seo.ts --base-url http://localhost:3075 \
 *     [--expected-origin http://localhost:3075] [--concurrency 5] \
 *     [--timeout-ms 10000] [--max-urls 300] [--redirect-samples 15]
 *
 * Output:
 *   - JSON report:   scripts/tmp/seo-verify-report.json (gitignored)
 *   - human summary: stdout
 *   - exit code 1 only if a P0-class finding exists (see P0_ISSUE_CODES)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(SCRIPTS_DIR, "tmp");
const REDIRECT_CSV = path.join(OUT_DIR, "redirect-disposition-classification.csv");

// ---------- CLI args ----------

function argValue(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx === process.argv.length - 1) return fallback;
  return process.argv[idx + 1];
}

// Guards CLI-only side effects (exiting on missing args, running main()) so
// this module stays safely importable from verify-prelaunch-seo.test.ts.
function isEntryModule(): boolean {
  return import.meta.url === `file://${process.argv[1]}`;
}

const rawBaseUrl = argValue("base-url") ?? "";
if (!rawBaseUrl && isEntryModule()) {
  console.error("Usage: verify-prelaunch-seo.ts --base-url http://localhost:3075 [options]");
  process.exit(2);
}
const BASE_URL = rawBaseUrl.replace(/\/+$/, "");
const EXPECTED_ORIGIN = (() => {
  const explicit = argValue("expected-origin");
  if (explicit) return explicit.replace(/\/+$/, "");
  if (!BASE_URL) return "";
  try {
    return new URL(BASE_URL).origin;
  } catch {
    return "";
  }
})();
const TIMEOUT_MS = Number(argValue("timeout-ms", "10000"));
const CONCURRENCY = Number(argValue("concurrency", "5"));
const MAX_URLS = Number(argValue("max-urls", "300"));
const REDIRECT_SAMPLE_SIZE = Number(argValue("redirect-samples", "15"));

// ---------- P0 issue codes (drive exit code) ----------

const P0_ISSUE_CODES = new Set([
  "SITEMAP_NON_200",
  "SITEMAP_DUPLICATE",
  "SITEMAP_UNREACHABLE",
  "CANONICAL_MISSING",
  "CANONICAL_MULTIPLE",
  "CANONICAL_WRONG_ORIGIN",
  "CANONICAL_TO_NON_200",
  "CANONICAL_TO_REDIRECT",
  "CANONICAL_HAS_QUERY_OR_HASH",
  "REDIRECT_LOOP",
  "REDIRECT_CHAIN_TOO_LONG",
  "ROBOTS_META_XROBOTS_CONTRADICTION",
  "JSONLD_PARSE_ERROR",
  "JSONLD_WRONG_ORIGIN",
  "CITY_DUPLICATE_WRONG_CITY_200",
  "LEGACY_REDIRECT_BROKEN",
]);

// ---------- fetch helpers ----------

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

interface RedirectHop {
  url: string;
  status: number;
  location: string | null;
}

interface FollowResult {
  finalUrl: string;
  finalStatus: number;
  hops: RedirectHop[];
  loop: boolean;
  html: string | null;
  headers: Headers | null;
}

async function followRedirects(startUrl: string, maxHops = 5): Promise<FollowResult> {
  const hops: RedirectHop[] = [];
  const seen = new Set<string>();
  let current = startUrl;

  for (let i = 0; i < maxHops; i++) {
    if (seen.has(current)) {
      return { finalUrl: current, finalStatus: -1, hops, loop: true, html: null, headers: null };
    }
    seen.add(current);

    let res: Response;
    try {
      res = await fetchWithTimeout(current);
    } catch {
      hops.push({ url: current, status: -1, location: null });
      return { finalUrl: current, finalStatus: -1, hops, loop: false, html: null, headers: null };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      hops.push({ url: current, status: res.status, location });
      if (!location) return { finalUrl: current, finalStatus: res.status, hops, loop: false, html: null, headers: res.headers };
      current = new URL(location, current).toString();
      continue;
    }

    hops.push({ url: current, status: res.status, location: null });
    const contentType = res.headers.get("content-type") ?? "";
    const html = contentType.includes("text/html") ? await res.text() : null;
    return { finalUrl: current, finalStatus: res.status, hops, loop: false, html, headers: res.headers };
  }

  return { finalUrl: current, finalStatus: -1, hops, loop: false, html: null, headers: null };
}

// ---------- HTML extraction (regex, no dependency) ----------
// Exported for scripts/verify-prelaunch-seo.test.ts (parser/rules tests).

export function extractCanonicals(html: string): string[] {
  const matches = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)];
  return matches
    .map((m) => {
      const hrefMatch = m[0].match(/\bhref=["']([^"']+)["']/i);
      return hrefMatch?.[1] ?? null;
    })
    .filter((v): v is string => Boolean(v));
}

export function extractRobotsMeta(html: string): string | null {
  const m = html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*\bcontent=["']([^"']+)["']/i);
  if (m) return m[1];
  const m2 = html.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']robots["']/i);
  return m2?.[1] ?? null;
}

export function extractJsonLdBlocks(html: string): string[] {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return matches.map((m) => m[1]);
}

/** Pure rule: which canonical-related P0 issue codes apply, given a page's extracted <link rel="canonical"> hrefs. */
export function checkCanonicalIssues(canonicals: string[], expectedOrigin: string, finalStatus: number): string[] {
  const issues: string[] = [];
  if (finalStatus !== 200) return issues;
  if (canonicals.length === 0) issues.push("CANONICAL_MISSING");
  if (canonicals.length > 1) issues.push("CANONICAL_MULTIPLE");
  for (const c of canonicals) {
    try {
      const cUrl = new URL(c);
      if (cUrl.origin !== expectedOrigin) issues.push("CANONICAL_WRONG_ORIGIN");
      if (cUrl.search || cUrl.hash) issues.push("CANONICAL_HAS_QUERY_OR_HASH");
    } catch {
      issues.push("CANONICAL_WRONG_ORIGIN");
    }
  }
  return issues;
}

/** Pure rule: does meta robots noindex agree with the X-Robots-Tag header? */
export function checkRobotsContradiction(robotsMeta: string | null, xRobotsTag: string | null): boolean {
  if (robotsMeta === null || xRobotsTag === null) return false;
  const metaNoindex = robotsMeta.toLowerCase().includes("noindex");
  const headerNoindex = xRobotsTag.toLowerCase().includes("noindex");
  return metaNoindex !== headerNoindex;
}

// ---------- bounded concurrency pool ----------

async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
  return results;
}

// ---------- sitemap ----------

async function fetchSitemapUrls(): Promise<{ urls: string[]; status: number; error?: string }> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/sitemap.xml`);
    if (res.status !== 200) return { urls: [], status: res.status };
    const xml = await res.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    return { urls, status: 200 };
  } catch (err) {
    return { urls: [], status: -1, error: String(err) };
  }
}

// ---------- page-level check ----------

interface PageReport {
  url: string;
  status: number;
  redirectHops: number;
  canonicals: string[];
  canonicalIssues: string[];
  robotsMeta: string | null;
  xRobotsTag: string | null;
  robotsContradiction: boolean;
  jsonLdCount: number;
  jsonLdParseErrors: number;
  jsonLdOriginIssues: string[];
  issues: string[];
}

function classifyPage(url: string, result: FollowResult): PageReport {
  const issues: string[] = [];

  if (result.loop) issues.push("REDIRECT_LOOP");
  if (result.hops.length > 3) issues.push("REDIRECT_CHAIN_TOO_LONG");

  const canonicals = result.html ? extractCanonicals(result.html) : [];
  const canonicalIssues = checkCanonicalIssues(canonicals, EXPECTED_ORIGIN, result.finalStatus);
  issues.push(...canonicalIssues);

  const robotsMeta = result.html ? extractRobotsMeta(result.html) : null;
  const xRobotsTag = result.headers?.get("x-robots-tag") ?? null;
  const robotsContradiction = checkRobotsContradiction(robotsMeta, xRobotsTag);
  if (robotsContradiction) issues.push("ROBOTS_META_XROBOTS_CONTRADICTION");

  const jsonLdBlocks = result.html ? extractJsonLdBlocks(result.html) : [];
  let jsonLdParseErrors = 0;
  const jsonLdOriginIssues: string[] = [];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block);
      const asString = JSON.stringify(parsed);
      const urlMatches = [...asString.matchAll(/"url":"([^"]+)"/g)];
      for (const m of urlMatches) {
        try {
          const u = new URL(m[1]);
          if ((u.hostname === "localhost" || u.hostname.endsWith(".local")) && u.origin !== EXPECTED_ORIGIN) {
            jsonLdOriginIssues.push(`JSONLD_WRONG_ORIGIN: ${m[1]}`);
          }
        } catch {
          // non-URL "url" field (rare) — ignore
        }
      }
    } catch {
      jsonLdParseErrors++;
    }
  }
  if (jsonLdParseErrors > 0) issues.push("JSONLD_PARSE_ERROR");
  if (jsonLdOriginIssues.length > 0) issues.push("JSONLD_WRONG_ORIGIN");

  return {
    url,
    status: result.finalStatus,
    redirectHops: result.hops.length - 1,
    canonicals,
    canonicalIssues,
    robotsMeta,
    xRobotsTag,
    robotsContradiction,
    jsonLdCount: jsonLdBlocks.length,
    jsonLdParseErrors,
    jsonLdOriginIssues,
    issues,
  };
}

// ---------- legacy redirect sample check ----------

interface RedirectSampleResult {
  source: string;
  disposition: string;
  expectedDestinationPath: string;
  finalStatus: number;
  finalUrl: string;
  hops: number;
  ok: boolean;
}

function loadRedirectSamples(n: number): Array<{ source: string; disposition: string; destination: string }> {
  if (!fs.existsSync(REDIRECT_CSV)) return [];
  const lines = fs.readFileSync(REDIRECT_CSV, "utf8").trim().split("\n").slice(1);
  const rows = lines
    .map((line) => {
      // columns: source,type,disposition,destination,clicks — simple split is fine, no embedded commas in these fields
      const [source, , disposition, destination] = line.split(",");
      return { source, disposition, destination };
    })
    .filter((r) => r.disposition === "EXACT_REDIRECT" || r.disposition === "VALID_HUB_REMAP");
  // deterministic sample: every Nth row rather than random
  const step = Math.max(1, Math.floor(rows.length / n));
  const sample: typeof rows = [];
  for (let i = 0; i < rows.length && sample.length < n; i += step) sample.push(rows[i]);
  return sample;
}

async function checkRedirectSamples(): Promise<RedirectSampleResult[]> {
  const samples = loadRedirectSamples(REDIRECT_SAMPLE_SIZE);
  return runPool(samples, CONCURRENCY, async (sample) => {
    const result = await followRedirects(`${BASE_URL}${sample.source}`, 3);
    const ok = result.finalStatus === 200 && result.hops.length <= 2 && !result.loop;
    return {
      source: sample.source,
      disposition: sample.disposition,
      expectedDestinationPath: sample.destination,
      finalStatus: result.finalStatus,
      finalUrl: result.finalUrl,
      hops: result.hops.length - 1,
      ok,
    };
  });
}

// ---------- city duplicate probe ----------

interface CityDuplicateProbe {
  kind: "place" | "offer";
  probedUrl: string;
  finalStatus: number;
  finalUrl: string;
  hops: number;
  ok: boolean;
}

async function checkCityDuplicates(sitemapUrls: string[]): Promise<CityDuplicateProbe[]> {
  const results: CityDuplicateProbe[] = [];

  const placeUrl = sitemapUrls.find((u) => /\/places\/[^/]+$/.test(new URL(u).pathname));
  if (placeUrl) {
    const slug = new URL(placeUrl).pathname.split("/").pop();
    const probed = `${BASE_URL}/totally-not-a-real-city/places/${slug}`;
    const result = await followRedirects(probed, 3);
    results.push({
      kind: "place",
      probedUrl: probed,
      finalStatus: result.finalStatus,
      finalUrl: result.finalUrl,
      hops: result.hops.length - 1,
      ok: result.finalStatus === 200 || (result.hops.length === 2 && result.finalStatus === 200),
    });
  }

  const offerUrl = sitemapUrls.find((u) => new URL(u).pathname.includes("/offers/"));
  if (offerUrl) {
    const parts = new URL(offerUrl).pathname.split("/").filter(Boolean); // [city, offers, section, slug]
    if (parts.length === 4) {
      const [, , section, slug] = parts;
      const probed = `${BASE_URL}/totally-not-a-real-city/offers/${section}/${slug}`;
      const result = await followRedirects(probed, 3);
      results.push({
        kind: "offer",
        probedUrl: probed,
        finalStatus: result.finalStatus,
        finalUrl: result.finalUrl,
        hops: result.hops.length - 1,
        ok: result.finalStatus === 200,
      });
    }
  }

  // A wrong-city probe is only a P0 if it returns 200 WITHOUT redirecting
  // to the real canonical (i.e. served the wrong-city page directly).
  for (const r of results) {
    const probedPath = new URL(r.probedUrl).pathname;
    const finalPath = r.finalStatus === 200 ? new URL(r.finalUrl).pathname : null;
    r.ok = r.finalStatus !== 200 || (finalPath !== null && finalPath !== probedPath);
  }

  return results;
}

// ---------- main ----------

async function main() {
  console.log(`[verify-prelaunch-seo] base=${BASE_URL} expectedOrigin=${EXPECTED_ORIGIN}`);

  const sitemap = await fetchSitemapUrls();
  const sitemapIssues: string[] = [];
  if (sitemap.status !== 200) sitemapIssues.push("SITEMAP_UNREACHABLE");
  const dupCount = sitemap.urls.length - new Set(sitemap.urls).size;
  if (dupCount > 0) sitemapIssues.push("SITEMAP_DUPLICATE");

  const crawlUrls = sitemap.urls.slice(0, MAX_URLS);
  const pageReports = await runPool(crawlUrls, CONCURRENCY, async (url) => {
    const result = await followRedirects(url, 3);
    const report = classifyPage(url, result);
    if (result.finalStatus !== 200) report.issues.push("SITEMAP_NON_200");
    if (result.hops.length > 1 && result.finalStatus === 200) report.issues.push("CANONICAL_TO_REDIRECT_SOURCE_IN_SITEMAP");
    return report;
  });

  const redirectSamples = await checkRedirectSamples();
  const cityDuplicates = await checkCityDuplicates(sitemap.urls);

  const allIssueCodes = new Set<string>();
  for (const p of pageReports) for (const i of p.issues) allIssueCodes.add(i);
  for (const s of sitemapIssues) allIssueCodes.add(s);
  for (const r of redirectSamples) if (!r.ok) allIssueCodes.add("LEGACY_REDIRECT_BROKEN");
  for (const c of cityDuplicates) if (!c.ok) allIssueCodes.add("CITY_DUPLICATE_WRONG_CITY_200");

  const p0Found = [...allIssueCodes].filter((code) => P0_ISSUE_CODES.has(code));

  const report = {
    baseUrl: BASE_URL,
    expectedOrigin: EXPECTED_ORIGIN,
    ranAt: new Date().toISOString(),
    sitemap: { status: sitemap.status, urlCount: sitemap.urls.length, duplicates: dupCount, issues: sitemapIssues },
    pagesCrawled: pageReports.length,
    pageReports,
    redirectSamples,
    cityDuplicates,
    p0Found,
    p0Count: p0Found.length,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const reportPath = path.join(OUT_DIR, "seo-verify-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\n=== SUMMARY ===");
  console.log(`sitemap: status=${sitemap.status} urls=${sitemap.urls.length} duplicates=${dupCount}`);
  console.log(`pages crawled: ${pageReports.length}`);
  console.log(`pages with issues: ${pageReports.filter((p) => p.issues.length > 0).length}`);
  console.log(`legacy redirect samples: ${redirectSamples.length} (broken: ${redirectSamples.filter((r) => !r.ok).length})`);
  console.log(`city-duplicate probes: ${cityDuplicates.length} (failing: ${cityDuplicates.filter((c) => !c.ok).length})`);
  console.log(`P0 issue codes found: ${p0Found.length > 0 ? p0Found.join(", ") : "none"}`);
  console.log(`\nFull report: ${reportPath}`);

  if (p0Found.length > 0) {
    console.log("\n=== P0 DETAIL ===");
    for (const p of pageReports) {
      const p0OnPage = p.issues.filter((i) => P0_ISSUE_CODES.has(i));
      if (p0OnPage.length > 0) console.log(`${p.url} :: ${p0OnPage.join(", ")}`);
    }
    for (const r of redirectSamples) if (!r.ok) console.log(`${r.source} -> ${r.finalUrl} (status ${r.finalStatus}, ${r.hops} hops) :: LEGACY_REDIRECT_BROKEN`);
    for (const c of cityDuplicates) if (!c.ok) console.log(`${c.probedUrl} -> ${c.finalUrl} (status ${c.finalStatus}) :: CITY_DUPLICATE_WRONG_CITY_200`);
    process.exitCode = 1;
  }
}

if (isEntryModule()) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

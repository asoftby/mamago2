/**
 * family-by-directory-place.parser.ts — v3
 *
 * Root cause fix:
 *   family.by HTML contains href attributes with embedded newlines, e.g.:
 *     href="https://family.by/spravka/dosug/bowling/1526-bouling-klub-trk-expobel.html\n"
 *   The \n breaks regex `\.html$` ($ doesn't match before \n by default).
 *   Fix: trim whitespace from every href before URL parsing and classification.
 *
 * Additional improvements:
 *   - Score-based place detection (not just address field)
 *   - Rich per-page debug output for diagnostics
 *   - Discovered links debug with accept/reject reasons
 */

import type { ImportSource } from "@prisma/client";
import type { PlaceImportParser } from "./base.parser";
import type { ParserResult, ParsedRawRecord } from "../types";
import { errorParserResult } from "./base.parser";
import { fetchHtml } from "./fetchHtml";

const PARSER_KEY = "family-by-directory-place";
const BASE_URL = "https://family.by";
const SPRAVKA_PREFIX = "/spravka/";
const DEFAULT_START_URL = `${BASE_URL}${SPRAVKA_PREFIX}`;

const MAX_DEPTH = 4;
const MAX_PAGES = 80;
const MAX_RECORDS = 100;
const DELAY_MS = 250;

// ── Category mapping ──────────────────────────────────────────────────────────

const PATH_SEGMENT_TO_CATEGORY: Record<string, string> = {
  dosug: "детский досуг", study: "образование", sport: "спорт",
  cafe: "детское кафе", shop: "магазин", uslugi: "услуги",
  medicine: "медицина", semotd: "семейный отдых", pregnancy: "беременность и роды",
  bowling: "боулинг", kino: "кинотеатр", theatre: "театр",
  muzvystavki: "музей", parki: "парк", zoo: "зоопарк",
  cirkzoo: "цирк и зоопарк", playcenter: "игровой центр",
  playrooms: "игровая комната", kvestroom: "квест",
  virtual: "виртуальная реальность", party: "детский праздник",
  outing: "загородный отдых", biblio: "библиотека", karting: "картинг",
  "creative-schools": "творческая школа", "drama-schools": "театральная школа",
  dance: "танцы", music: "музыкальная школа",
  swimming: "бассейн", watersport: "водный спорт",
  kidsfriendly: "семейное кафе", cafeparty: "кафе для праздников",
  sweet: "кондитерская", usadby: "усадьба", nosmoke: "кафе без курения",
  zaly: "концертный зал",
};

function categoriesFromPath(urlPath: string): string[] {
  const segments = urlPath.split("/").filter(Boolean);
  const cats: string[] = [];
  for (const seg of segments) {
    if (seg in PATH_SEGMENT_TO_CATEGORY) cats.push(PATH_SEGMENT_TO_CATEGORY[seg]);
  }
  return cats.length > 0 ? cats : ["детский досуг"];
}

// ── URL helpers ───────────────────────────────────────────────────────────────

/**
 * Detail page: /spravka/ + 1-3 path segments + /\d+-slug.html
 * Uses trimmed URL — no whitespace issues.
 */
function isDetailPage(url: string): boolean {
  return /\/spravka\/.+\/\d+-[a-z0-9-]+\.html$/.test(url);
}

function isListingPage(url: string): boolean {
  const path = new URL(url).pathname;
  return path.startsWith(SPRAVKA_PREFIX) && path.endsWith("/");
}

function getPathDepth(url: string): number {
  const path = new URL(url).pathname;
  return path.split("/").filter(Boolean).length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Link extraction ───────────────────────────────────────────────────────────

/**
 * Extract links with debug info — shows why each href was accepted or rejected.
 */
function extractSpravkaLinksDebug(
  html: string,
  pageUrl: string,
): Array<{ raw: string; normalized: string | null; accepted: boolean; reason: string }> {
  const results: Array<{ raw: string; normalized: string | null; accepted: boolean; reason: string }> = [];
  const seen = new Set<string>();
  const re = /href="([^"]+)"/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const raw = m[1];
    const cleaned = raw.replace(/[\s\n\r\t]/g, "");

    if (results.length >= 50) break; // cap debug output

    let normalized: string | null = null;
    let reason = "";

    try {
      const url = new URL(cleaned, pageUrl);
      if (url.hostname !== "family.by") {
        reason = `external: ${url.hostname}`;
      } else if (!url.pathname.startsWith(SPRAVKA_PREFIX)) {
        reason = `not /spravka/: ${url.pathname.slice(0, 40)}`;
      } else {
        url.hash = "";
        url.search = "";
        normalized = url.toString();
        if (seen.has(normalized)) {
          reason = "duplicate";
        } else {
          seen.add(normalized);
          reason = "ok";
        }
      }
    } catch {
      reason = `invalid URL: ${cleaned.slice(0, 40)}`;
    }

    const hadNewline = /[\n\r]/.test(raw);
    if (hadNewline) reason = `had newline (fixed) → ${reason}`;

    results.push({
      raw: raw.slice(0, 80),
      normalized,
      accepted: normalized !== null && reason.startsWith("ok"),
      reason,
    });
  }

  return results;
}

// ── Score-based place detection ───────────────────────────────────────────────

interface PageSignals {
  hasAddress: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  hasContentBlock: boolean;
  hasOgTitle: boolean;
  hasListingCards: boolean;
}

function analyzePageSignals(html: string): PageSignals {
  return {
    hasAddress:      /id="xfadress"|<b>Адрес:/i.test(html),
    hasPhone:        /<b>Телефон:/i.test(html),
    hasWebsite:      /<b>Сайт:/i.test(html),
    hasContentBlock: /id="news-id-\d+"/i.test(html),
    hasOgTitle:      /og:title/i.test(html),
    // Listing cards have repeated "padding: 12px 15px 11px 5px" pattern
    hasListingCards: (html.match(/padding:\s*12px\s+15px\s+11px\s+5px/g) ?? []).length >= 3,
  };
}

/**
 * Score-based: page is place-like if it has enough signals.
 * Returns numeric score for debug visibility.
 */
function placeScore(signals: PageSignals): number {
  let score = 0;
  if (signals.hasAddress)      score += 3;
  if (signals.hasPhone)        score += 2;
  if (signals.hasWebsite)      score += 2;
  if (signals.hasContentBlock) score += 1;
  if (signals.hasOgTitle)      score += 1;
  if (signals.hasListingCards) score -= 4;
  return score;
}

function isPlaceLikePage(signals: PageSignals): boolean {
  return placeScore(signals) >= 2;
}

// ── Detail page extraction ────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function extractField(html: string, label: string): string | null {
  const re = new RegExp(
    `<b>${label}[^<]*</b>[^<]*(?:<span[^>]*>([^<]*)</span>|<a[^>]*>([^<]*)</a>|([^<\n]{1,200}))`,
    "i",
  );
  const m = html.match(re);
  if (!m) return null;
  const val = (m[1] ?? m[2] ?? m[3] ?? "").trim();
  return val.length > 0 ? val : null;
}

function extractOgTitle(html: string): string | null {
  const m = html.match(/og:title"\s+content="([^"]+)"/i);
  if (!m) return null;
  return m[1].replace(/\s*[•·]\s*Family\.by\s*$/i, "").trim() || null;
}

function extractDescription(html: string): string | null {
  const m = html.match(/id="news-id-\d+"[^>]*>([\s\S]{0,2000}?)<\/div>/i);
  return m ? stripTags(m[1]).slice(0, 500).trim() || null : null;
}

function extractImages(html: string): string[] {
  const imgs: string[] = [];
  const re = /uploads\/posts\/(?!.*thumbs)([^\s"']+\.(jpg|png|gif))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = `${BASE_URL}/uploads/posts/${m[1]}`;
    if (!imgs.includes(url)) imgs.push(url);
    if (imgs.length >= 3) break;
  }
  return imgs;
}

// ── Debug types ───────────────────────────────────────────────────────────────

export interface PageDebugInfo {
  url: string;
  depth: number;
  pageType: "listing" | "detail" | "unknown";
  signals: PageSignals;
  placeScore: number;
  isPlaceLike: boolean;
  extracted: boolean;
  linksFound: number;
  skipReason?: string;
}

export interface LinkDebugInfo {
  raw: string;
  normalized: string | null;
  accepted: boolean;
  reason: string;
}

export interface CrawlDebugInfo {
  startUrl: string;
  pagesVisited: number;
  linksDiscovered: number;
  acceptedLinks: number;
  detailCandidates: number;
  recordsExtracted: number;
  pagesSkipped: number;
  limitReached: "maxPages" | "maxRecords" | null;
  warnings: string[];
  visitedPages: PageDebugInfo[];
  discoveredLinks: LinkDebugInfo[];
  skippedUrls: Array<{ url: string; reason: string }>;
}

// ── Main parser ───────────────────────────────────────────────────────────────

export const familyByDirectoryPlaceParser: PlaceImportParser = {
  parserKey: PARSER_KEY,
  entityType: "PLACE",

  async parse(source: ImportSource): Promise<ParserResult & { debug?: CrawlDebugInfo }> {
    const startUrl = source.baseUrl?.trim() || DEFAULT_START_URL;

    if (!startUrl.includes("family.by/spravka")) {
      return errorParserResult(
        PARSER_KEY,
        `Invalid baseUrl: "${startUrl}". Must be a family.by /spravka/ URL.`,
      );
    }

    const debug: CrawlDebugInfo = {
      startUrl,
      pagesVisited: 0,
      linksDiscovered: 0,
      acceptedLinks: 0,
      detailCandidates: 0,
      recordsExtracted: 0,
      pagesSkipped: 0,
      limitReached: null,
      warnings: [],
      visitedPages: [],
      discoveredLinks: [],
      skippedUrls: [],
    };

    const visited = new Set<string>();
    const records: ParsedRawRecord[] = [];
    const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

    while (queue.length > 0) {
      if (debug.pagesVisited >= MAX_PAGES) {
        debug.limitReached = "maxPages";
        debug.warnings.push(`Reached maxPages limit (${MAX_PAGES}).`);
        break;
      }
      if (records.length >= MAX_RECORDS) {
        debug.limitReached = "maxRecords";
        debug.warnings.push(`Reached maxRecords limit (${MAX_RECORDS}).`);
        break;
      }

      const item = queue.shift()!;
      const { url, depth } = item;

      if (visited.has(url)) continue;
      visited.add(url);

      if (depth > MAX_DEPTH) {
        debug.pagesSkipped++;
        if (debug.skippedUrls.length < 20) {
          debug.skippedUrls.push({ url, reason: `depth ${depth} > maxDepth ${MAX_DEPTH}` });
        }
        continue;
      }

      // Fetch
      let html: string;
      try {
        const response = await fetchHtml(url, { encoding: "windows-1251", timeoutMs: 12_000, retries: 2 });
        html = response.html;
        debug.pagesVisited++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debug.warnings.push(`Fetch failed ${url}: ${msg}`);
        debug.pagesSkipped++;
        if (debug.skippedUrls.length < 20) {
          debug.skippedUrls.push({ url, reason: `fetch error: ${msg}` });
        }
        continue;
      }

      const signals = analyzePageSignals(html);
      const isDetail = isDetailPage(url);
      const isListing = isListingPage(url);
      const placeLike = isPlaceLikePage(signals);
      const score = placeScore(signals);

      const pageInfo: PageDebugInfo = {
        url,
        depth,
        pageType: isDetail ? "detail" : isListing ? "listing" : "unknown",
        signals,
        placeScore: score,
        isPlaceLike: placeLike,
        extracted: false,
        linksFound: 0,
      };

      // ── Detail page ──────────────────────────────────────────────────────
      if (isDetail || (!isListing && placeLike)) {
        debug.detailCandidates++;

        if (!placeLike && !signals.hasAddress) {
          pageInfo.skipReason = "score too low — not place-like";
          debug.pagesSkipped++;
          if (debug.skippedUrls.length < 20) {
            debug.skippedUrls.push({ url, reason: pageInfo.skipReason });
          }
        } else {
          const name = extractOgTitle(html);
          if (!name) {
            pageInfo.skipReason = "no og:title";
            debug.pagesSkipped++;
            if (debug.skippedUrls.length < 20) {
              debug.skippedUrls.push({ url, reason: "no og:title" });
            }
          } else {
            const address = extractField(html, "Адрес");
            const phone = extractField(html, "Телефон");
            const websiteRaw = extractField(html, "Сайт");
            const website = websiteRaw
              ? websiteRaw.startsWith("http") ? websiteRaw : `https://${websiteRaw}`
              : null;
            const description = extractDescription(html);
            const images = extractImages(html);
            const categories = categoriesFromPath(new URL(url).pathname);

            const idMatch = url.match(/\/(\d+)-[^/]+\.html$/);
            const externalId = idMatch ? `family-by-${idMatch[1]}` : null;

            records.push({
              externalId,
              sourceUrl: url,
              canonicalSourceUrl: url,
              rawPayload: {
                name,
                description,
                address: address ? `${address}, Минск` : null,
                city: "Минск",
                phone,
                website,
                categories,
                images,
              },
              sourceUpdatedAt: new Date(),
            });

            debug.recordsExtracted++;
            pageInfo.extracted = true;
          }
        }

        debug.visitedPages.push(pageInfo);
        await sleep(DELAY_MS);
        continue;
      }

      // ── Listing page: collect links ──────────────────────────────────────
      if (isListing) {
        const linkDebug = extractSpravkaLinksDebug(html, url);
        // Collect debug info for first listing page only (to avoid huge output)
        if (debug.discoveredLinks.length < 60) {
          debug.discoveredLinks.push(...linkDebug.slice(0, 30));
        }

        const accepted = linkDebug.filter((l) => l.accepted && l.normalized);
        debug.linksDiscovered += linkDebug.length;
        debug.acceptedLinks += accepted.length;
        pageInfo.linksFound = accepted.length;

        for (const { normalized } of accepted) {
          if (!normalized || visited.has(normalized)) continue;
          const linkDepth = getPathDepth(normalized);
          if (linkDepth > MAX_DEPTH + 1) continue;
          queue.push({ url: normalized, depth: linkDepth });
        }

        debug.visitedPages.push(pageInfo);
        await sleep(DELAY_MS);
        continue;
      }

      // Unknown — skip
      pageInfo.skipReason = "not listing or detail, not place-like";
      debug.pagesSkipped++;
      if (debug.skippedUrls.length < 20) {
        debug.skippedUrls.push({ url, reason: pageInfo.skipReason });
      }
      debug.visitedPages.push(pageInfo);
    }

    if (records.length === 0) {
      const msg = debug.pagesVisited === 0
        ? `Could not fetch starting URL: ${startUrl}`
        : `No place records found after visiting ${debug.pagesVisited} pages. ` +
          `Detail candidates: ${debug.detailCandidates}. ` +
          `Limit: ${debug.limitReached ?? "none"}. ` +
          `Warnings: ${debug.warnings.slice(0, 3).join("; ") || "none"}`;

      return { records: [], totalFound: 0, parserKey: PARSER_KEY, error: msg, debug } as never;
    }

    return { records, totalFound: records.length, parserKey: PARSER_KEY, debug } as never;
  },
};

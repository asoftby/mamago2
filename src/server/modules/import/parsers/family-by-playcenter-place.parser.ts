/**
 * family-by-playcenter-place.parser.ts
 *
 * Production parser для family.by — категория «Игровые центры».
 * parserKey: "family-by-playcenter-place"
 * entityType: PLACE
 *
 * Strategy:
 *   1. Load category page (source.baseUrl or default)
 *   2. Extract all detail page links matching /spravka/dosug/playcenter/\d+-slug.html
 *   3. For each detail page: extract place fields
 *   4. Return ParsedRawRecord[]
 *
 * HTML structure (category listing):
 *   Each card: <div style="padding: 12px 15px 11px 5px;">
 *     <a href="/spravka/dosug/playcenter/ID-slug.html">NAME</a>
 *     <div id="news-id-ID">DESCRIPTION</div>
 *     <div>ADDRESS</div>
 *
 * HTML structure (detail page):
 *   <span id="xfadress">ADDRESS</span>
 *   <b>Телефон:</b> PHONE
 *   <b>Сайт:</b> <a href="...">WEBSITE</a>
 *   <div id="news-id-ID">DESCRIPTION</div>
 *   og:title → NAME
 *
 * Encoding: windows-1251
 */

import type { ImportSource } from "@prisma/client";
import type { PlaceImportParser } from "./base.parser";
import type { ParserResult, ParsedRawRecord } from "../types";
import { errorParserResult } from "./base.parser";
import { fetchHtml } from "./fetchHtml";

const PARSER_KEY = "family-by-playcenter-place";
const BASE_URL = "https://family.by";
const DEFAULT_CATEGORY_URL = `${BASE_URL}/spravka/dosug/playcenter/`;
const DELAY_MS = 300;
const DEFAULT_MAX_DETAIL_PAGES = 60;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Category page: extract detail links ──────────────────────────────────────

/**
 * Extract all detail page URLs from the category listing page.
 * Matches: /spravka/dosug/playcenter/\d+-slug.html (absolute or relative)
 * Strips newlines from href values (family.by wraps long URLs).
 */
function extractDetailLinks(html: string, categoryUrl: string): string[] {
  const seen = new Set<string>();
  const links: string[] = [];

  const re = /href="([^"]+)"/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    // Strip whitespace/newlines from href
    const cleaned = m[1].replace(/[\s\n\r\t]/g, "");
    if (!cleaned) continue;

    try {
      const url = new URL(cleaned, categoryUrl);
      // Must be family.by, must match detail pattern
      if (url.hostname !== "family.by") continue;
      if (!/\/spravka\/dosug\/playcenter\/\d+-[a-z0-9-]+\.html$/.test(url.pathname)) continue;

      url.hash = "";
      url.search = "";
      const normalized = url.toString();

      if (!seen.has(normalized)) {
        seen.add(normalized);
        links.push(normalized);
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return links;
}

// ── Detail page: extract place fields ────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function extractOgTitle(html: string): string | null {
  const m = html.match(/og:title"\s+content="([^"]+)"/i);
  if (!m) return null;
  return m[1].replace(/\s*[•·]\s*Family\.by\s*$/i, "").trim() || null;
}

function extractLabeledField(html: string, label: string): string | null {
  // Matches: <b>LABEL:</b> VALUE or <b>LABEL:</b> <span>VALUE</span> or <b>LABEL:</b> <a>VALUE</a>
  const re = new RegExp(
    `<b>${label}[^<]*</b>[^<]*(?:<span[^>]*>([^<]*)</span>|<a[^>]*>([^<]*)</a>|([^<\n]{1,300}))`,
    "i",
  );
  const m = html.match(re);
  if (!m) return null;
  const val = (m[1] ?? m[2] ?? m[3] ?? "").trim();
  return val.length > 0 ? val : null;
}

function extractDescription(html: string): string | null {
  const m = html.match(/id="news-id-\d+"[^>]*>([\s\S]{0,3000}?)<\/div>/i);
  if (!m) return null;
  return stripTags(m[1]).slice(0, 600).trim() || null;
}

function extractImages(html: string): string[] {
  const imgs: string[] = [];
  // Full-size images (not thumbs) in content area
  const re = /uploads\/posts\/(?!.*thumbs)([^\s"']+\.(jpg|png|gif))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = `${BASE_URL}/uploads/posts/${m[1]}`;
    if (!imgs.includes(url)) imgs.push(url);
    if (imgs.length >= 3) break;
  }
  return imgs;
}

interface ExtractedPlace {
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  images: string[];
}

function extractPlaceFromDetail(html: string): ExtractedPlace | null {
  const name = extractOgTitle(html);
  if (!name) return null;

  const address = extractLabeledField(html, "Адрес");
  const phone = extractLabeledField(html, "Телефон");
  const websiteRaw = extractLabeledField(html, "Сайт");
  const website = websiteRaw
    ? websiteRaw.startsWith("http") ? websiteRaw : `https://${websiteRaw}`
    : null;
  const description = extractDescription(html);
  const images = extractImages(html);

  return { name, description, address, phone, website, images };
}

// ── Debug summary ─────────────────────────────────────────────────────────────

export interface PlaycenterParserDebug {
  categoryUrl: string;
  finalUrl: string;
  htmlLength: number;
  listItemsCount: number;
  detailLinksFound: number;
  detailPagesVisited: number;
  recordsExtracted: number;
  skippedPages: number;
  warnings: string[];
  sampleDetailLinks: string[];
  sampleRecords: Array<{
    url: string;
    name: string | null;
    hasAddress: boolean;
    hasPhone: boolean;
    hasWebsite: boolean;
  }>;
}

// ── Main parser ───────────────────────────────────────────────────────────────

export const familyByPlaycenterPlaceParser: PlaceImportParser = {
  parserKey: PARSER_KEY,
  entityType: "PLACE",

  async parse(source: ImportSource): Promise<ParserResult & { debug?: PlaycenterParserDebug }> {
    const categoryUrl = source.baseUrl?.trim() || DEFAULT_CATEGORY_URL;
    const MAX_DETAIL_PAGES = source.crawlMaxDetailLinks ?? source.crawlMaxRecords ?? DEFAULT_MAX_DETAIL_PAGES;

    if (!categoryUrl.includes("family.by")) {
      return errorParserResult(PARSER_KEY, `Invalid baseUrl: "${categoryUrl}". Expected a family.by URL.`);
    }

    const debug: PlaycenterParserDebug = {
      categoryUrl,
      finalUrl: categoryUrl,
      htmlLength: 0,
      listItemsCount: 0,
      detailLinksFound: 0,
      detailPagesVisited: 0,
      recordsExtracted: 0,
      skippedPages: 0,
      warnings: [],
      sampleDetailLinks: [],
      sampleRecords: [],
    };

    // ── Step 1: Load category page ───────────────────────────────────────
    let categoryHtml: string;
    try {
      const result = await fetchHtml(categoryUrl, { encoding: "windows-1251", timeoutMs: 12_000, retries: 2 });
      categoryHtml = result.html;
      debug.finalUrl = result.finalUrl;
      debug.htmlLength = categoryHtml.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        records: [],
        totalFound: 0,
        parserKey: PARSER_KEY,
        error: `Failed to load category page ${categoryUrl}: ${msg}`,
        debug,
      } as never;
    }

    // Count listing cards (diagnostic)
    const cardMatches = categoryHtml.match(/padding:\s*12px\s+15px\s+11px\s+5px/g);
    debug.listItemsCount = cardMatches?.length ?? 0;

    if (debug.listItemsCount === 0) {
      return {
        records: [],
        totalFound: 0,
        parserKey: PARSER_KEY,
        error: `No place cards found on category page ${categoryUrl}. ` +
          `HTML length: ${debug.htmlLength}. The page structure may have changed.`,
        debug,
      } as never;
    }

    // ── Step 2: Extract detail links ─────────────────────────────────────
    const detailLinks = extractDetailLinks(categoryHtml, categoryUrl);
    debug.detailLinksFound = detailLinks.length;
    debug.sampleDetailLinks = detailLinks.slice(0, 5);

    if (detailLinks.length === 0) {
      return {
        records: [],
        totalFound: 0,
        parserKey: PARSER_KEY,
        error: `Found ${debug.listItemsCount} listing cards but extracted 0 detail links. ` +
          `Expected URLs matching /spravka/dosug/playcenter/\\d+-slug.html`,
        debug,
      } as never;
    }

    // ── Step 3: Visit detail pages ───────────────────────────────────────
    const records: ParsedRawRecord[] = [];
    const limit = Math.min(detailLinks.length, MAX_DETAIL_PAGES);

    for (let i = 0; i < limit; i++) {
      const detailUrl = detailLinks[i];

      let html: string;
      try {
        const result = await fetchHtml(detailUrl, { encoding: "windows-1251", timeoutMs: 12_000, retries: 2 });
        html = result.html;
        debug.detailPagesVisited++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debug.warnings.push(`Fetch failed ${detailUrl}: ${msg}`);
        debug.skippedPages++;
        continue;
      }

      const place = extractPlaceFromDetail(html);

      if (!place) {
        debug.warnings.push(`No extractable place data on ${detailUrl}`);
        debug.skippedPages++;
        continue;
      }

      // External ID from URL numeric segment
      const idMatch = detailUrl.match(/\/(\d+)-[^/]+\.html$/);
      const externalId = idMatch ? `family-by-${idMatch[1]}` : null;

      records.push({
        externalId,
        sourceUrl: detailUrl,
        canonicalSourceUrl: detailUrl,
        rawPayload: {
          name: place.name,
          description: place.description,
          address: place.address ? `${place.address}, Минск` : null,
          city: "Минск",
          phone: place.phone,
          website: place.website,
          categories: ["игровой центр"],
          images: place.images,
        },
        sourceUpdatedAt: new Date(),
      });

      debug.recordsExtracted++;

      // Sample for debug
      if (debug.sampleRecords.length < 5) {
        debug.sampleRecords.push({
          url: detailUrl,
          name: place.name,
          hasAddress: !!place.address,
          hasPhone: !!place.phone,
          hasWebsite: !!place.website,
        });
      }

      await sleep(DELAY_MS);
    }

    if (detailLinks.length > MAX_DETAIL_PAGES) {
      debug.warnings.push(
        `Category has ${detailLinks.length} detail links, processed first ${MAX_DETAIL_PAGES}.`,
      );
    }

    // ── Result ───────────────────────────────────────────────────────────
    if (records.length === 0) {
      return {
        records: [],
        totalFound: 0,
        parserKey: PARSER_KEY,
        error: `Found ${detailLinks.length} detail links and visited ${debug.detailPagesVisited} pages, ` +
          `but extracted 0 place records. ` +
          `Skipped: ${debug.skippedPages}. ` +
          `Warnings: ${debug.warnings.slice(0, 3).join("; ") || "none"}`,
        debug,
      } as never;
    }

    return {
      records,
      totalFound: records.length,
      parserKey: PARSER_KEY,
      debug,
    } as never;
  },
};

/**
 * family-by-place.parser.ts
 *
 * Production parser для family.by — справочник мест для детей и семей в Минске.
 * parserKey: "family-by-place"
 * entityType: PLACE
 *
 * HTML structure (listing page):
 *   <div id="dle-content">
 *     <div style="padding: 12px 15px 11px 5px;">
 *       <table>
 *         <td class="imgback" ...>  ← thumbnail image
 *         <td class="news">
 *           <a href="/spravka/..."><strong>NAME</strong></a>
 *           <div id="news-id-XXXX">DESCRIPTION</div>
 *           <div>ADDRESS</div>
 *           <div class="xfraion">DISTRICT</div>
 *
 * Encoding: windows-1251 → converted to utf-8 before parsing.
 * No headless browser required — static HTML.
 */

import type { ImportSource } from "@prisma/client";
import type { PlaceImportParser } from "./base.parser";
import type { ParserResult, ParsedRawRecord } from "../types";
import { errorParserResult } from "./base.parser";
import { fetchHtml } from "./fetchHtml";

const PARSER_KEY = "family-by-place";
const BASE_URL = "https://family.by";
// ── Category mapping: URL path segment → category label ──────────────────────

const PATH_TO_CATEGORY: Record<string, string> = {
  "dosug":    "детский досуг",
  "study":    "образование",
  "sport":    "спорт",
  "cafe":     "детское кафе",
  "shop":     "магазин",
  "uslugi":   "услуги",
  "medicine": "медицина",
  "semotd":   "семейный отдых",
  "pregnancy":"беременность и роды",
  // sub-categories
  "zaly":           "концертный зал",
  "bowling":        "боулинг",
  "kino":           "кинотеатр",
  "teatr":          "театр",
  "muzei":          "музей",
  "park":           "парк",
  "aquapark":       "аквапарк",
  "zoo":            "зоопарк",
  "igrovye":        "игровая зона",
  "batut":          "батутный центр",
  "kvest":          "квест",
  "creative-schools": "творческая школа",
  "drama-schools":  "театральная школа",
  "dance":          "танцы",
  "music":          "музыкальная школа",
  "sport-schools":  "спортивная школа",
};

function categoryFromPath(href: string): string[] {
  // href like /spravka/dosug/zaly/12345-name.html
  const parts = href.split("/").filter(Boolean);
  const cats: string[] = [];
  for (const part of parts) {
    if (part in PATH_TO_CATEGORY) cats.push(PATH_TO_CATEGORY[part]);
  }
  return cats.length > 0 ? cats : ["детский досуг"];
}

// ── HTML parsing helpers (no external deps — regex-based) ────────────────────

/**
 * Extract content of #dle-content div.
 * The listing items are inside this container.
 */
function extractDleContent(html: string): string {
  const match = html.match(/<div[^>]+id=['"]dle-content['"][^>]*>([\s\S]*?)<\/div>\s*<\/td>/);
  return match ? match[1] : html;
}

/**
 * Extract all place items from listing HTML.
 * Each item is a <div style="padding: 12px 15px 11px 5px;"> block.
 */
function extractItems(html: string): string[] {
  const items: string[] = [];
  // Split on item boundaries
  const parts = html.split(/<div\s+style="padding:\s*12px\s+15px\s+11px\s+5px;">/i);
  for (let i = 1; i < parts.length; i++) {
    // Take up to the next item boundary or end
    const end = parts[i].indexOf('<div style="padding: 12px 15px 11px 5px;">');
    items.push(end > 0 ? parts[i].slice(0, end) : parts[i]);
  }
  return items;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&nbsp;/g, " ").trim();
}

/**
 * Parse one listing item block into a raw payload.
 */
function parseItem(
  itemHtml: string,
  listingUrl: string,
): ParsedRawRecord | null {
  // ── href + name ──────────────────────────────────────────────────────────
  const linkMatch = itemHtml.match(
    /<a\s+href="(\/spravka\/[^"]+\.html)"[^>]*>\s*<strong>([^<]+)<\/strong>/i,
  );
  if (!linkMatch) return null;

  const relHref = linkMatch[1];
  const name = linkMatch[2].trim();
  if (!name) return null;

  const itemUrl = `${BASE_URL}${relHref}`;

  // ── External ID from URL slug ────────────────────────────────────────────
  const slugMatch = relHref.match(/\/(\d+)-[^/]+\.html$/);
  const externalId = slugMatch ? `family-by-${slugMatch[1]}` : null;

  // ── Image ────────────────────────────────────────────────────────────────
  const imgMatch = itemHtml.match(/background-image:\s*url\(([^)]+)\)/i);
  const imageUrl = imgMatch ? imgMatch[1].replace(/^\/\//, "https://").trim() : null;
  const hasRealImage = imageUrl && !imageUrl.includes("no_image") && !imageUrl.includes("/d.png");

  // ── Description ──────────────────────────────────────────────────────────
  const descMatch = itemHtml.match(/<div\s+id="news-id-\d+"[^>]*>([\s\S]*?)<\/div>/i);
  const description = descMatch ? stripTags(descMatch[1]).trim() || null : null;

  // ── Address ──────────────────────────────────────────────────────────────
  // Address is in a plain <div> after the description div, before xfraion
  const addrMatch = itemHtml.match(
    /<\/div>\s*<div>([^<]{5,100})<\/div>\s*<div class="xfraion"/i,
  );
  const address = addrMatch ? addrMatch[1].trim() : null;

  // ── District ─────────────────────────────────────────────────────────────
  const districtMatch = itemHtml.match(/<div class="xfraion"[^>]*>([^<]*)<\/div>/i);
  const district = districtMatch ? districtMatch[1].trim() || null : null;

  // ── Categories from URL path ─────────────────────────────────────────────
  const categories = categoryFromPath(relHref);

  const rawPayload: Record<string, unknown> = {
    name,
    description,
    address: address ? `${address}, Минск` : null,
    city: "Минск",
    district,
    categories,
    images: hasRealImage ? [imageUrl] : [],
    sourceUrl: itemUrl,
    listingUrl,
  };

  return {
    externalId,
    sourceUrl: itemUrl,
    canonicalSourceUrl: itemUrl,
    rawPayload,
    sourceUpdatedAt: new Date(),
  };
}

// ── Main parser ───────────────────────────────────────────────────────────────

export const familyByPlaceParser: PlaceImportParser = {
  parserKey: PARSER_KEY,
  entityType: "PLACE",

  async parse(source: ImportSource): Promise<ParserResult> {
    const targetUrl = source.baseUrl?.trim();

    if (!targetUrl) {
      return errorParserResult(
        PARSER_KEY,
        "ImportSource.baseUrl is required for family-by-place parser. " +
        "Set it to a family.by listing URL, e.g. https://family.by/spravka/dosug/",
      );
    }

    let html: string;
    try {
      const response = await fetchHtml(targetUrl, {
        encoding: "windows-1251",
        timeoutMs: 15_000,
        retries: 2,
      });
      html = response.html;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorParserResult(PARSER_KEY, `Failed to fetch ${targetUrl}: ${msg}`);
    }

    // Validate we got a family.by page
    if (!html.includes("family.by") && !html.includes("dle-content")) {
      return errorParserResult(
        PARSER_KEY,
        `Unexpected response from ${targetUrl} — not a family.by listing page`,
      );
    }

    const content = extractDleContent(html);
    const itemBlocks = extractItems(content);

    if (itemBlocks.length === 0) {
      return {
        records: [],
        totalFound: 0,
        parserKey: PARSER_KEY,
        error: `No place items found on ${targetUrl}. ` +
          "Check that the URL points to a /spravka/ listing page with place cards.",
      };
    }

    const records: ParsedRawRecord[] = [];
    for (const block of itemBlocks) {
      const record = parseItem(block, targetUrl);
      if (record) records.push(record);
    }

    return {
      records,
      totalFound: records.length,
      parserKey: PARSER_KEY,
    };
  },
};

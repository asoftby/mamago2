/**
 * abws-performances-event.parser.ts
 *
 * Production EVENT parser for the ABWS (24afisha.by) sync API.
 * parserKey: "abws-performances-event"
 * entityType: EVENT
 *
 * Scope: docs/imports/abws-phase1-spec.md §3 only — fetch + raw field
 * mapping. Does NOT do:
 *   - LLM normalization (§6) — `llm.*` fields below are left null/empty as
 *     explicit TODOs for a follow-up PR.
 *   - Partner-event dedup (§7).
 *   - Place matching (§2.3) or ActivitySession persistence (§2.2) — those
 *     are downstream normalize/match-stage concerns per §3's own open
 *     question about extending normalizeRunRecords/matchRunRecords for
 *     session-level ABWS data; this parser only returns rawPayload.
 *
 * API: one HTTP call, no `lastSync` (unconfirmed for this host — see
 * spec §1). `distributor_company_id=550` is ABWS-specific business
 * config, not admin-configurable per source instance.
 */

import type { ImportSource } from "@prisma/client";

import type { EventImportParser } from "./base.parser";
import type { ParsedRawRecord, ParserResult } from "../types";
import { errorParserResult } from "./base.parser";
import { fetchHtml } from "./fetchHtml";

const PARSER_KEY = "abws-performances-event";
const DEFAULT_API_URL = "https://webgate.24guru.by/api/v3/sync/data/performances";
const DISTRIBUTOR_COMPANY_ID = 550;

// ── Raw ABWS API shapes (best-effort — unconfirmed fields marked below) ────

export interface AbwsPerformanceType {
  id: number;
  name?: string | null;
}

/**
 * Confirmed via live call (performance.id=5852465, 2026-09-13): both
 * `performance.image` and each entry of `performance.images[]` are objects
 * keyed by thumbnail size (e.g. "240x340", "880x550") plus an "original"
 * key — never a flat URL string. Keys observed vary per image.
 */
export interface AbwsImageSizes {
  original?: string | null;
  [size: string]: string | null | undefined;
}

export interface AbwsPerformance {
  id: number;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  minAge?: number | null;
  duration?: number | null; // minutes, confirmed (range 2-480 observed)
  showFrom?: number | null; // unix seconds
  showTo?: number | null; // unix seconds
  image?: AbwsImageSizes | null;
  images?: AbwsImageSizes[] | null;
  minPrice?: string | null; // rubles, string e.g. "34.00"
  maxPrice?: string | null;
  types?: AbwsPerformanceType[] | null;
  urlSaleframe?: string | null;
  deletedAt?: string | null;
}

export interface AbwsSessionCity {
  slug?: string | null;
}

export interface AbwsSessionObject {
  id: number;
  name?: string | null;
  address?: string | null;
  city?: AbwsSessionCity | null;
}

export interface AbwsSessionTag {
  name: string;
}

export interface AbwsSession {
  id: number;
  timeSpending: number; // unix seconds
  minPrice?: number | null; // kopecks — UNCONFIRMED unit, see BACKLOG-147
  maxPrice?: number | null;
  urlSaleframe?: string | null;
  isSaleOpen?: boolean | null;
  deletedAt?: string | null;
  object?: AbwsSessionObject | null;
  tags?: AbwsSessionTag[] | null;
  type?: string | null; // "default" | "related" — "related" purpose unconfirmed
  url?: string | null;
}

export interface AbwsPerformanceItem {
  performance: AbwsPerformance;
  sessions: AbwsSession[];
}

// ── §5.1 category whitelist ─────────────────────────────────────────────────
// `types[]` mixes event categories with specific venue names (e.g. "Брестский
// театр драмы" id 54 appears as a "type" alongside "Кино" id 1). Only the
// confirmed category ids below are treated as categories; everything else is
// logged (not guessed at) so the whitelist can be extended from real data.
const CATEGORY_TYPE_IDS = new Set<number>([1, 2, 3, 15, 16, 17, 22, 29, 41]);
// 1 Кино, 2 Концерты, 3 Театр, 15 Спорт, 16 Цирк, 17 Квесты и квизы,
// 22 Фестивали, 29 Музеи и выставки, 41 Активный отдых.

export function filterCategoryTypeIds(
  types: AbwsPerformanceType[] | null | undefined,
): { categoryTypeIds: number[]; unrecognizedTypes: AbwsPerformanceType[] } {
  const categoryTypeIds: number[] = [];
  const unrecognizedTypes: AbwsPerformanceType[] = [];

  for (const type of types ?? []) {
    if (CATEGORY_TYPE_IDS.has(type.id)) {
      categoryTypeIds.push(type.id);
    } else {
      unrecognizedTypes.push(type);
    }
  }

  return { categoryTypeIds, unrecognizedTypes };
}

// ── §0 single-venue vs multi-venue split ────────────────────────────────────

export function isSingleVenue(sessions: AbwsSession[]): boolean {
  const venueIds = new Set(
    sessions.map((s) => s.object?.id).filter((id): id is number => id != null),
  );
  return venueIds.size <= 1;
}

// ── §5 session tag normalization ────────────────────────────────────────────
// "2 D" and "2D" are observed as distinct raw values for the same tag.

export function normalizeSessionTagName(name: string): string {
  return name.replace(/\s+/g, "").trim().toLowerCase();
}

export function normalizeSessionTags(tags: AbwsSessionTag[] | null | undefined): string[] {
  const seen = new Set<string>();
  for (const tag of tags ?? []) {
    const normalized = normalizeSessionTagName(tag.name);
    if (normalized) seen.add(normalized);
  }
  return Array.from(seen);
}

// ── §2.4 price handling — rubles (performance) vs raw kopecks (session), ───
// never combined behind one conversion function.

function parsePerformancePriceRub(value: string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// ── §5 session mapping ───────────────────────────────────────────────────────

export interface AbwsSessionRawPayload {
  externalId: string;
  /**
   * ISO instant derived from `session.timeSpending` (unix seconds).
   * Unix time is UTC by definition, so no timezone math is applied here —
   * NOT yet empirically verified against a real ABWS session that the
   * source's "unix timestamp" is a genuine UTC epoch and not a Minsk
   * wall-clock value misencoded as one. Verify once live data is
   * available (see PR description).
   */
  startsAt: string;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  buyUrl: string | null;
  isSaleOpen: boolean | null;
  withdrawnAt: string | null;
  tags: string[];
  type: string | null;
  venue: AbwsSessionObject | null;
  /**
   * true when `session.object.city.slug` disagrees with the city segment
   * implied by `session.url`. Spec §5 calls for an ImportReviewTask here;
   * that's a match/review-stage concern (out of this parser's scope), so
   * this flag is surfaced for that stage to act on instead.
   */
  citySlugMismatch: boolean;
}

/**
 * `session.url` observed shape (confirmed live, performance.id=5852465):
 * `https://24afisha.by/ru/{citySlug}/events/{category}/{performanceId}?sid=...`
 * — city is the SECOND path segment, after a locale prefix (`ru`). Using
 * the first segment (an earlier version of this function did) always
 * extracted the locale and made every session look mismatched.
 */
function citySlugFromSessionUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[1] ?? null;
  } catch {
    return null;
  }
}

export function mapAbwsSession(session: AbwsSession): AbwsSessionRawPayload {
  const citySlugFromObject = session.object?.city?.slug ?? null;
  const citySlugFromUrl = citySlugFromSessionUrl(session.url);

  return {
    externalId: session.id.toString(),
    startsAt: new Date(session.timeSpending * 1000).toISOString(),
    priceMinCents: session.minPrice ?? null,
    priceMaxCents: session.maxPrice ?? null,
    buyUrl: session.urlSaleframe ?? null,
    isSaleOpen: session.isSaleOpen ?? null,
    withdrawnAt: session.deletedAt ?? null,
    tags: normalizeSessionTags(session.tags),
    type: session.type ?? null,
    venue: session.object ?? null,
    citySlugMismatch: Boolean(
      citySlugFromObject && citySlugFromUrl && citySlugFromObject !== citySlugFromUrl,
    ),
  };
}

// ── §5 performance -> rawPayload mapping ────────────────────────────────────

export interface AbwsPerformanceRawPayload {
  title: string;
  /** Raw source description — LLM rewrite target (§6), not for direct publish. */
  description: string | null;
  ageMin: number | null;
  durationMinutes: number | null;
  showFrom: string | null;
  showTo: string | null;
  images: string[];
  /** Fallback event-level price in rubles — used only if the event has no sessions. */
  perfPriceMinRub: number | null;
  perfPriceMaxRub: number | null;
  categoryTypeIds: number[];
  unrecognizedTypes: AbwsPerformanceType[];
  /** Fallback purchase link — used only if the event has no sessions. */
  perfBuyUrl: string | null;
  isSingleVenue: boolean;
  sessions: AbwsSessionRawPayload[];
  llm: {
    category: string | null;
    categoryConfidence: number | null;
    categoryAlternatives: string[];
    audience: string | null;
    audienceConfidence: number | null;
    ageMax: number | null;
    interests: string[];
    occasions: string[];
    description: string | null;
    flags: string[];
  };
}

function unixSecondsToIso(value: number | null | undefined): string | null {
  return value == null ? null : new Date(value * 1000).toISOString();
}

/**
 * `image`/`images[]` entries are keyed by thumbnail size, not flat URLs
 * (confirmed live). Prefer "original"; fall back to any string value
 * present rather than dropping the image if "original" is absent.
 */
function extractImageUrl(image: AbwsImageSizes | null | undefined): string | null {
  if (!image) return null;
  if (image.original) return image.original;
  const firstStringValue = Object.values(image).find((v): v is string => typeof v === "string");
  return firstStringValue ?? null;
}

export function mapAbwsPerformanceToRawPayload(item: AbwsPerformanceItem): AbwsPerformanceRawPayload {
  const { performance, sessions } = item;
  const { categoryTypeIds, unrecognizedTypes } = filterCategoryTypeIds(performance.types);
  const images = [performance.image, ...(performance.images ?? [])]
    .map(extractImageUrl)
    .filter((url): url is string => Boolean(url));

  return {
    title: performance.name,
    description: performance.description ?? null,
    ageMin: performance.minAge ?? null,
    durationMinutes: performance.duration ?? null,
    showFrom: unixSecondsToIso(performance.showFrom),
    showTo: unixSecondsToIso(performance.showTo),
    images,
    perfPriceMinRub: parsePerformancePriceRub(performance.minPrice),
    perfPriceMaxRub: parsePerformancePriceRub(performance.maxPrice),
    categoryTypeIds,
    unrecognizedTypes,
    perfBuyUrl: performance.urlSaleframe ?? null,
    isSingleVenue: isSingleVenue(sessions),
    sessions: sessions.map(mapAbwsSession),
    // §6 LLM normalization — out of scope for this PR, left as explicit TODO.
    llm: {
      category: null,
      categoryConfidence: null,
      categoryAlternatives: [],
      audience: null,
      audienceConfidence: null,
      ageMax: null,
      interests: [],
      occasions: [],
      description: null,
      flags: [],
    },
  };
}

export function dedupeKey(item: AbwsPerformanceItem): string {
  return item.performance.id.toString();
}

// ── HTTP fetch ───────────────────────────────────────────────────────────────

/**
 * The ABWS wiki's response envelope for this endpoint is not confirmed from
 * the fixture alone (only field-level shapes were captured). Handle the
 * plausible shapes defensively and surface the real top-level keys in the
 * error if none match, so a live run can pin this down definitively.
 */
export function parseAbwsResponseBody(body: string): AbwsPerformanceItem[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`ABWS response is not valid JSON: ${msg}`);
  }

  if (Array.isArray(parsed)) return parsed as AbwsPerformanceItem[];

  if (parsed && typeof parsed === "object") {
    for (const key of ["data", "items", "performances", "result"]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as AbwsPerformanceItem[];
    }

    throw new Error(
      `Unrecognized ABWS response envelope. Top-level keys: ${Object.keys(parsed).join(", ")}`,
    );
  }

  throw new Error(`Unrecognized ABWS response shape: ${typeof parsed}`);
}

export async function fetchAbwsPerformances(source: ImportSource): Promise<AbwsPerformanceItem[]> {
  const apiKey = process.env.ABWS_KEY;
  if (!apiKey) {
    throw new Error("ABWS_KEY environment variable is not set.");
  }

  const baseUrl = source.baseUrl?.trim() || DEFAULT_API_URL;
  const url = new URL(baseUrl);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("distributor_company_id", String(DISTRIBUTOR_COMPANY_ID));
  // No `lastSync` param — unconfirmed for this host (spec §1). Always fetch
  // the full catalog; incrementality is built on our own contentHash side.

  const loggableUrl = `${url.origin}${url.pathname}?distributor_company_id=${DISTRIBUTOR_COMPANY_ID}&key=***`;

  const response = await fetchHtml(url.toString(), {
    headers: { Accept: "application/json" },
    timeoutMs: 30_000,
    retries: 2,
  });

  // Per the ABWS wiki: log HTTP status + body on every call. The full body
  // is ~13MB for the real catalog, so log a bounded preview rather than the
  // whole thing; full-length logging only kicks in on parse failure below,
  // where the body is expected to be small (an error payload, not the
  // catalog).
  console.log("[import.abws] fetch complete", {
    url: loggableUrl,
    status: response.status,
    bodyLength: response.html.length,
    bodyPreview: response.html.slice(0, 500),
  });

  try {
    return parseAbwsResponseBody(response.html);
  } catch (err) {
    console.error("[import.abws] failed to parse response body", {
      url: loggableUrl,
      status: response.status,
      body: response.html,
    });
    throw err;
  }
}

// ── Parser export ────────────────────────────────────────────────────────────

export const abwsPerformancesEventParser: EventImportParser = {
  parserKey: PARSER_KEY,
  entityType: "EVENT",

  async parse(source: ImportSource): Promise<ParserResult> {
    let items: AbwsPerformanceItem[];
    try {
      items = await fetchAbwsPerformances(source);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorParserResult(PARSER_KEY, `Failed to fetch ABWS performances: ${msg}`);
    }

    const records: ParsedRawRecord[] = items.map((item) => {
      const rawPayload = mapAbwsPerformanceToRawPayload(item);
      // `urlSaleframe` is the only known per-performance URL; when it's
      // absent, fall back to a synthetic (not a real public page) reference
      // rather than inventing an unverified 24afisha.by URL pattern.
      const sourceUrl =
        item.performance.urlSaleframe ?? `${DEFAULT_API_URL}#performance-${item.performance.id}`;

      return {
        externalId: dedupeKey(item),
        sourceUrl,
        rawPayload: rawPayload as unknown as Record<string, unknown>,
        sourceUpdatedAt: new Date(),
      } satisfies ParsedRawRecord;
    });

    return {
      records,
      totalFound: records.length,
      parserKey: PARSER_KEY,
    };
  },
};

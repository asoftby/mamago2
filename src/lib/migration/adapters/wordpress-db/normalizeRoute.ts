import type { MigrationWarning, NormalizedRecord } from "../../types";
import { groupIndexedMeta } from "./groupIndexedMeta";
import type { WordPressRouteBundle, WordPressTermRow } from "./types";

const SOURCE_ENTITY_TYPE = "wordpress-db:routes";
const STOP_FIELDS = ["title", "description", "images"] as const;

/**
 * Confirmed live against real data (2026-07-13): no `RouteStop` → `Place`
 * reference exists anywhere in Route postmeta. A full, unfiltered postmeta
 * dump for two real published routes (17822, 18437 — 85 rows, zero
 * exceptions) contains only `title-location-N` / `description-location-N`
 * / `images-location-N` (attachment ids) plus route-level fields; nothing
 * resembling a WP Place post id per stop. `placeId` is therefore always
 * `null` in this phase — not a stub awaiting later wiring, a fact about
 * the source data. See `src/lib/migration/place-resolution/types.ts` for
 * the resolver shape this would use if a source reference ever existed
 * (and for `Event.placeIdRaw`, which does have one).
 */
export interface NormalizedRouteStopCandidate {
  index: number;
  title: string | null;
  description: string | null;
  imageAttachmentIds: readonly number[];
  placeId: null;
}

/** Raw taxonomy reference — no mapping to any mamaGo taxonomy/enum happens here (same convention as normalizePlace/normalizeEvent). */
export interface NormalizedRouteSourceTerm {
  termId: number;
  taxonomy: string;
  name: string;
  slug: string;
}

/** The route-level (not per-stop) WP `location` postmeta value, parsed. */
export interface NormalizedRouteLocation {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Everything this normalizer is confident about extracting verbatim from a
 * `WordPressRouteBundle`. `route-duration`, `reels-route`, and
 * `route-budget` are deliberately never read here — see the "Routes"
 * addendum in docs/migration/wordpress-to-mamago.md:
 * - duration is computed dynamically from stops via an API in the target
 *   product, there is no `Route` field for it and there will not be one;
 * - budget is likewise never statically imported — in the target model
 *   `Route.budgetLevel` is derived from per-stop prices
 *   (`summarizeRouteBudget`), which the editor fills in during the manual
 *   review pass over imported routes. A static WP-taxonomy-term ->
 *   `BudgetLevel` mapping would only ever be thrown away once that review
 *   sets real per-stop prices, so it was never worth building.
 *
 * These are decisions, not gaps to fill in later. `Route.budgetLevel` is
 * simply left at its schema default (`LOW`) for imported routes — this
 * normalizer never sets it.
 */
export interface NormalizedRouteCandidate {
  title: string;
  slug: string;
  status: string;
  publishedAt: string;
  modifiedAt: string;
  stops: readonly NormalizedRouteStopCandidate[];
  /** Raw `location` postmeta value, unparsed (present alongside `location` below whenever JSON parsing succeeds). */
  locationRaw: string | null;
  /** `null` when `locationRaw` is absent or not valid JSON — never guessed from partial text. */
  location: NormalizedRouteLocation | null;
  media: {
    featuredAttachmentId: number | null;
  };
  seo: {
    title: string | null;
    focusKeyword: string | null;
  };
  /** Raw taxonomy terms attached to the post (including any `route-budget` term — passed through unmapped, like everything else here). No mapping applied. */
  sourceTerms: readonly NormalizedRouteSourceTerm[];
  /**
   * Full postmeta passthrough, keyed by meta_key. Covers every field this
   * normalizer doesn't lift into a named property above — including
   * `route-duration`/`reels-route`/`route-budget` (all deliberately
   * dropped, see above), `text`/`url-map` (Google Maps embed links, not
   * yet mapped to a product field), `story conclusion`, and all
   * `voxel:*`/`rank_math_*` analytics/SEO noise.
   */
  rawMeta: Readonly<Record<string, readonly string[]>>;
}

function firstMetaValue(postMeta: WordPressRouteBundle["postMeta"], key: string): string | null {
  return postMeta[key]?.[0] ?? null;
}

function parsePositiveIntOrNull(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** `images-location-N` is a single comma-separated attachment-id string, not repeated meta rows (confirmed live: e.g. `"17885,17886"`). */
function parseCommaSeparatedAttachmentIds(raw: string | undefined): {
  ids: number[];
  invalidRaw: string[];
} {
  if (!raw) return { ids: [], invalidRaw: [] };
  const ids: number[] = [];
  const invalidRaw: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const n = Number(trimmed);
    if (Number.isInteger(n) && n > 0) {
      ids.push(n);
    } else {
      invalidRaw.push(trimmed);
    }
  }
  return { ids, invalidRaw };
}

function toSourceTerm(term: WordPressTermRow): NormalizedRouteSourceTerm {
  return { termId: term.term_id, taxonomy: term.taxonomy, name: term.name, slug: term.slug };
}

function buildStops(
  postMeta: WordPressRouteBundle["postMeta"],
  sourceRecordKey: string,
): { stops: NormalizedRouteStopCandidate[]; warnings: MigrationWarning[]; mediaRefs: string[] } {
  const { groups, warnings: groupWarnings } = groupIndexedMeta(postMeta, [...STOP_FIELDS], "location");
  const warnings = groupWarnings.map((w) => ({ ...w, sourceRecordKey }));
  const mediaRefs: string[] = [];

  const stops = groups.map(({ index, values }) => {
    const { ids, invalidRaw } = parseCommaSeparatedAttachmentIds(values.images);
    for (const invalid of invalidRaw) {
      warnings.push({
        code: "ROUTE_STOP_MEDIA_SOURCE_INVALID",
        message: `Stop ${index} images-location value contains a non-numeric attachment id.`,
        severity: "WARNING",
        sourceRecordKey,
        details: { index, value: invalid },
      });
    }
    mediaRefs.push(...ids.map((id) => String(id)));

    return {
      index,
      title: values.title ?? null,
      description: values.description ?? null,
      imageAttachmentIds: ids,
      placeId: null,
    };
  });

  if (stops.length === 0) {
    warnings.push({
      code: "ROUTE_NO_STOPS",
      message: "No title-location-N/description-location-N/images-location-N groups found for this route.",
      severity: "WARNING",
      sourceRecordKey,
    });
  }

  return { stops, warnings, mediaRefs };
}

function parseRouteLocation(raw: string | null): NormalizedRouteLocation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const address = typeof parsed.address === "string" ? parsed.address : null;
    const latitude = typeof parsed.latitude === "number" ? parsed.latitude : null;
    const longitude = typeof parsed.longitude === "number" ? parsed.longitude : null;
    return { address, latitude, longitude };
  } catch {
    return null;
  }
}

export function normalizeRoute(bundle: WordPressRouteBundle): NormalizedRecord {
  const { post, postMeta, terms } = bundle;
  const sourceRecordKey = `${SOURCE_ENTITY_TYPE}:${post.ID}`;
  const warnings: MigrationWarning[] = [];

  const { stops, warnings: stopWarnings, mediaRefs: stopMediaRefs } = buildStops(postMeta, sourceRecordKey);
  warnings.push(...stopWarnings);

  const locationRaw = firstMetaValue(postMeta, "location");
  const location = parseRouteLocation(locationRaw);
  if (locationRaw && !location) {
    warnings.push({
      code: "ROUTE_LOCATION_UNPARSEABLE",
      message: "Route-level location postmeta value is not valid JSON; kept only as locationRaw.",
      severity: "WARNING",
      sourceRecordKey,
      details: { locationRaw },
    });
  }

  const featuredAttachmentId = parsePositiveIntOrNull(firstMetaValue(postMeta, "_thumbnail_id"));

  const mediaRefs = [
    ...(featuredAttachmentId !== null ? [String(featuredAttachmentId)] : []),
    ...stopMediaRefs,
  ].filter((ref, index, all) => all.indexOf(ref) === index);

  const relationRefs = terms.map((term) => `term:${term.taxonomy}:${term.slug}`);

  const normalizedPayload: NormalizedRouteCandidate = {
    title: post.post_title,
    slug: post.post_name,
    status: post.post_status,
    publishedAt: post.post_date,
    modifiedAt: post.post_modified,
    stops,
    locationRaw,
    location,
    media: {
      featuredAttachmentId,
    },
    seo: {
      title: firstMetaValue(postMeta, "rank_math_title"),
      focusKeyword: firstMetaValue(postMeta, "rank_math_focus_keyword"),
    },
    sourceTerms: terms.map(toSourceTerm),
    rawMeta: postMeta,
  };

  return {
    sourceRecordKey,
    sourceEntityType: SOURCE_ENTITY_TYPE,
    targetTypeHint: "ROUTE",
    normalizedPayload,
    mediaRefs,
    relationRefs,
    warnings,
  };
}

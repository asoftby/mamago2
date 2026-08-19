import { createHash } from "node:crypto";

import {
  hasMeaningfulElementorMeta,
  hasWebStoryMeta,
} from "./articleSourceRepresentation";
import type {
  WordPressArticleBundle,
  WordPressEventBundle,
  WordPressPlaceBundle,
  WordPressPostMetaByKey,
  WordPressPostRow,
  WordPressRouteBundle,
  WordPressOfferBundle,
  WordPressTermRow,
} from "./types";

/**
 * Bumped whenever the canonical hash *input* changes shape (a new
 * allowlisted field added/removed, a serialization rule changed) — never
 * for unrelated code changes. Baked into the returned hash string itself
 * (`"<version>:<sha256>"`) rather than a separate persisted column, so
 * this never needs a Prisma migration: every hash produced by this module
 * is self-describing, and a `v1` (raw-bundle) hash can never collide with
 * or be silently compared equal to a `v2` hash — they're now literally
 * different strings.
 *
 * `v1` was `sha256(stableStringify(bundle))` over the *entire* raw
 * `{post, postMeta, terms}` bundle — every WordPress/plugin-internal
 * postmeta key included unfiltered, which is exactly the bug this file
 * fixes (see `docs/migration/prelaunch-checklist.md`, Events source-drift
 * investigation, 2026-07-20: `rank_math_internal_links_processed`,
 * `voxel:view_counts`/`voxel:view_chart_cache`, `_edit_lock` and similar
 * plugin/cron housekeeping fields flipped the hash with zero change to
 * any field an entity's normalizer actually reads).
 */
export const CANONICAL_SOURCE_HASH_VERSION = "wordpress-db-domain-v2";

// ---------------------------------------------------------------------------
// Canonical, deterministic serialization — same rules as the old
// `stableStringify` (object keys sorted so caller-side key-insertion order
// never matters; array *order* preserved, since only call sites that
// already made that order canonical themselves pass an array in here).
// ---------------------------------------------------------------------------

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

/**
 * `<version>:<sha256 of the canonical input>` — the version prefix means a
 * `v1` value can never equal a `v2` value, without requiring any schema
 * change to distinguish them.
 */
function versionedHash(canonicalInput: unknown): string {
  const digest = createHash("sha256").update(stableStringify(canonicalInput)).digest("hex");
  return `${CANONICAL_SOURCE_HASH_VERSION}:${digest}`;
}

/**
 * Only the `post` columns some normalizer actually reads into its
 * candidate. Never `post_modified`/`post_date`/`guid`/`post_parent`/
 * `post_author`/`post_type`/`post_mime_type` unless a specific entity's
 * config below says otherwise — confirmed by grepping every
 * `normalize*.ts` for `post.<field>` usage (see PR body / prelaunch
 * checklist for the exact audit). `post_modified` in particular is kept
 * only as `SourceRecordEnvelope.sourceUpdatedAt` (diagnostic, set
 * independently in `wordpressDbAdapter.ts` — never part of this hash),
 * since it's WordPress's own "last touched" timestamp and updates via
 * plugin/cron activity with zero domain-content change.
 */
function pickPostFields(post: WordPressPostRow, fields: readonly (keyof WordPressPostRow)[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    result[field] = post[field];
  }
  return result;
}

/**
 * `allowlistKeys` for exact-match domain postmeta keys; `allowlistPatterns`
 * for WordPress's repeated-group convention (Route's `title-location-N` /
 * `description-location-N` / `images-location-N` — see
 * `groupIndexedMeta.ts`). Each matched key's *own* value array is included
 * verbatim, preserving order — that's where a multi-value key like
 * `gallery` carries real domain-order meaning (`ActivityImage.sortOrder`).
 * Any key not matched (every plugin/cron/housekeeping key confirmed absent
 * from every normalizer's own field reads) is silently excluded — a brand
 * new, never-seen-before plugin meta key added to WordPress tomorrow has
 * no effect on the hash unless it also gets allowlisted here, which only
 * happens when a normalizer is taught to actually read it.
 */
function pickPostMeta(
  postMeta: WordPressPostMetaByKey,
  allowlistKeys: readonly string[],
  allowlistPatterns: readonly RegExp[] = [],
): Record<string, readonly string[]> {
  const result: Record<string, readonly string[]> = {};
  const keySet = new Set(allowlistKeys);
  for (const [key, values] of Object.entries(postMeta)) {
    const matches = keySet.has(key) || allowlistPatterns.some((pattern) => pattern.test(key));
    if (matches) {
      result[key] = values;
    }
  }
  return result;
}

/**
 * Taxonomy term *order* carries no domain meaning anywhere it's consumed
 * (category/age-tag matching iterates by name/slug, never by position) —
 * canonicalized by sorting on `taxonomy:slug` so SQL row order (which
 * depends on join/index internals, not anything WordPress-editorial) can
 * never affect the hash. `term_id` is deliberately excluded: recreating a
 * WP term (same taxonomy+slug+name, new numeric id) is not a domain
 * change, but a raw `term_id` would flip the hash for it anyway.
 */
function canonicalTerms(terms: readonly WordPressTermRow[]): readonly string[] {
  return [...terms].map((t) => `${t.taxonomy}:${t.slug}:${t.name}`).sort();
}

const ARTICLE_POST_FIELDS: readonly (keyof WordPressPostRow)[] = [
  "post_title",
  "post_content",
  "post_excerpt",
  "post_status",
  "post_name",
  "post_date",
];
const ARTICLE_POSTMETA_ALLOWLIST: readonly string[] = [
  "_thumbnail_id",
  "rank_math_title",
  "rank_math_focus_keyword",
  "rank_math_description",
  "rank_math_facebook_title",
  "rank_math_facebook_description",
  "rank_math_robots",
  "rank_math_canonical_url",
  "_wp_old_slug",
];

/**
 * `normalizeArticle()` never hashes raw `_elementor_data` / Web Story
 * payloads. It only projects the same semantic booleans the normalizer
 * computes (`hasMeaningfulElementorMeta` / `hasWebStoryMeta`). Empty
 * leftover keys and `_elementor_template_type` alone must hash like
 * absence — presence-only detection was a false-positive source of
 * ARTICLE_BLOCKED. Hashing the raw (often huge) Elementor JSON would
 * still make the hash sensitive to builder-internal churn with zero
 * visible `post_content` change. Payload bytes are therefore excluded;
 * only empty ↔ real-builder and absent ↔ non-blank story meta flip the
 * flag.
 */
function articleContentFlags(postMeta: WordPressPostMetaByKey): { hasElementorContent: boolean; hasWebStoryContent: boolean } {
  return {
    hasElementorContent: hasMeaningfulElementorMeta(postMeta),
    hasWebStoryContent: hasWebStoryMeta(postMeta),
  };
}

export function buildArticleCanonicalSourceHashInput(bundle: WordPressArticleBundle): unknown {
  return {
    version: CANONICAL_SOURCE_HASH_VERSION,
    post: pickPostFields(bundle.post, ARTICLE_POST_FIELDS),
    postMeta: pickPostMeta(bundle.postMeta, ARTICLE_POSTMETA_ALLOWLIST),
    contentFlags: articleContentFlags(bundle.postMeta),
    terms: canonicalTerms(bundle.terms),
  };
}

export function hashArticleBundle(bundle: WordPressArticleBundle): string {
  return versionedHash(buildArticleCanonicalSourceHashInput(bundle));
}

const PLACE_POST_FIELDS: readonly (keyof WordPressPostRow)[] = [
  "post_title",
  "post_content",
  "post_excerpt",
  "post_status",
  "post_name",
];
const PLACE_POSTMETA_ALLOWLIST: readonly string[] = [
  "_thumbnail_id",
  "cover",
  "gallery",
  "gallery-place",
  "logo",
  "logo-place",
  "location",
  "phone",
  "email",
  "work_hours",
  "short-desc-place",
  "city-place",
  "rank_math_title",
  "rank_math_focus_keyword",
];

/**
 * `normalizePlace()` reads real coordinates from `placeIndex.lat`/`.lng`
 * (`wp_voxel_index_places`), not from any postmeta key — those feed
 * `NormalizedPlaceCandidate.coordinates` directly. Omitting this table
 * from the hash meant a real coordinate edit produced a false
 * `SKIP_UNCHANGED`. `priority` is excluded: confirmed unread by
 * `normalizePlace()`, so including it would reintroduce exactly the kind
 * of "hashed but not domain-significant" field this whole fix removes
 * elsewhere.
 *
 * Mirrors `normalizePlace()`'s own `hasCoordinates` check exactly
 * (`placeIndex != null && placeIndex.lat !== null && placeIndex.lng !== null`)
 * rather than projecting the raw index row: a missing row, a row with
 * `{lat: null, lng: null}`, and a row with only one coordinate present
 * all normalize to the same `coordinates: null` — hashing the raw row
 * shape would have made those equivalent states look different and
 * produced a false `UPDATE` for a Place whose coordinates were never
 * actually resolvable, before or after.
 */
function placeCoordinatesProjection(placeIndex: WordPressPlaceBundle["placeIndex"]): { lat: number; lng: number } | null {
  if (!placeIndex || placeIndex.lat === null || placeIndex.lng === null) {
    return null;
  }
  return { lat: placeIndex.lat, lng: placeIndex.lng };
}

export function buildPlaceCanonicalSourceHashInput(bundle: WordPressPlaceBundle): unknown {
  return {
    version: CANONICAL_SOURCE_HASH_VERSION,
    post: pickPostFields(bundle.post, PLACE_POST_FIELDS),
    postMeta: pickPostMeta(bundle.postMeta, PLACE_POSTMETA_ALLOWLIST),
    placeCoordinates: placeCoordinatesProjection(bundle.placeIndex),
    terms: canonicalTerms(bundle.terms),
  };
}

export function hashPlaceBundle(bundle: WordPressPlaceBundle): string {
  return versionedHash(buildPlaceCanonicalSourceHashInput(bundle));
}

const OFFER_POST_FIELDS: readonly (keyof WordPressPostRow)[] = ["post_title", "post_content", "post_excerpt", "post_status", "post_name", "post_date", "post_author", "post_type"];
const OFFER_POSTMETA_ALLOWLIST = ["short-description", "short-description-service", "program-cost", "average-check-program", "hb-program-duration", "max-guests-program", "program-booking-settings", "gallery", "logo", "main-image-service", "phone", "phone-service", "program-phone", "website", "website-service", "program-website", "external-url", "rank_math_title", "rank_math_description", "rank_math_focus_keyword", "rank_math_canonical_url", "rank_math_robots", "rank_math_facebook_title", "rank_math_facebook_description", "_wp_old_slug"] as const;
export function buildOfferCanonicalSourceHashInput(bundle: WordPressOfferBundle): unknown {
  return {
    version: CANONICAL_SOURCE_HASH_VERSION,
    post: pickPostFields(bundle.post, OFFER_POST_FIELDS),
    postMeta: pickPostMeta(bundle.postMeta, OFFER_POSTMETA_ALLOWLIST),
    terms: canonicalTerms(bundle.terms),
    placeRelations: [...bundle.placeRelations].map(r => ({ relatedPostId: r.related_post_id, relatedPostType: r.related_post_type, relationKey: r.relation_key, relationSide: r.relation_side })).sort((a,b) => stableStringify(a).localeCompare(stableStringify(b))),
  };
}
export function hashOfferBundle(bundle: WordPressOfferBundle): string { return versionedHash(buildOfferCanonicalSourceHashInput(bundle)) }

const EVENT_POST_FIELDS: readonly (keyof WordPressPostRow)[] = [
  "post_title",
  "post_content",
  "post_excerpt",
  "post_status",
  "post_name",
];
const EVENT_POSTMETA_ALLOWLIST: readonly string[] = [
  "_thumbnail_id",
  "gallery",
  "event_date",
  "event-place-name",
  "location",
  "adress-event-place",
  "event_city",
  "event_place",
  "event-place",
  "event_place_id",
  "place_id",
  "event-cost",
  "url-buy-ticket",
  "external_event_id",
  "external_last_updated",
  "trailer-url",
  "rank_math_title",
  "rank_math_focus_keyword",
  "age",
  "age_text",
  "ageRange",
  "age_range",
  "event_age",
];

export function buildEventCanonicalSourceHashInput(bundle: WordPressEventBundle): unknown {
  return {
    version: CANONICAL_SOURCE_HASH_VERSION,
    post: pickPostFields(bundle.post, EVENT_POST_FIELDS),
    postMeta: pickPostMeta(bundle.postMeta, EVENT_POSTMETA_ALLOWLIST),
    terms: canonicalTerms(bundle.terms),
  };
}

export function hashEventBundle(bundle: WordPressEventBundle): string {
  return versionedHash(buildEventCanonicalSourceHashInput(bundle));
}

/**
 * No `post_content`/`post_excerpt` — `normalizeRoute()`'s own
 * `NormalizedRouteCandidate` has no route-level description field at all
 * (title, slug, status, stops, location, media, SEO, terms only; see its
 * doc comment). Hashing raw WP content the normalizer never reads would
 * make Route sourceHash flip on edits with zero effect on the target
 * model. Stop-level descriptions are real domain data and are already
 * covered separately via `description-location-N`.
 */
const ROUTE_POST_FIELDS: readonly (keyof WordPressPostRow)[] = [
  "post_title",
  "post_status",
  "post_name",
];
const ROUTE_POSTMETA_ALLOWLIST: readonly string[] = [
  "_thumbnail_id",
  "location",
  "rank_math_title",
  "rank_math_focus_keyword",
];
/**
 * Route stops: `<title|description|images>-location-<index>` — see
 * `groupIndexedMeta.ts`. `route-duration`/`reels-route`/`route-budget`
 * are deliberately never matched (`normalizeRoute.ts` never reads them —
 * see its own doc comment), same as any other unmatched key.
 */
const ROUTE_POSTMETA_PATTERN_ALLOWLIST: readonly RegExp[] = [/^(title|description|images)-location-\d+$/];

export function buildRouteCanonicalSourceHashInput(bundle: WordPressRouteBundle): unknown {
  return {
    version: CANONICAL_SOURCE_HASH_VERSION,
    post: pickPostFields(bundle.post, ROUTE_POST_FIELDS),
    postMeta: pickPostMeta(bundle.postMeta, ROUTE_POSTMETA_ALLOWLIST, ROUTE_POSTMETA_PATTERN_ALLOWLIST),
    terms: canonicalTerms(bundle.terms),
  };
}

export function hashRouteBundle(bundle: WordPressRouteBundle): string {
  return versionedHash(buildRouteCanonicalSourceHashInput(bundle));
}

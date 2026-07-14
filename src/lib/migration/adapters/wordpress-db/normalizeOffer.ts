import { AGE_OPTIONS } from "@/lib/config/ages";

import type { MigrationWarning, NormalizedRecord } from "../../types";
import type { WordPressOfferBundle, WordPressOfferPlaceRelationRow, WordPressTermRow } from "./types";
import { buildOfferSourceRecordKey } from "./types";

/**
 * `post.post_type` is the actual source-entity discriminator (`hb-programs`
 * | `services`) — see `buildOfferSourceRecordKey`. This constant exists only
 * for the doc-comment/grep convenience every other normalizer's
 * `SOURCE_ENTITY_TYPE` gives; Offer's `sourceRecordKey` is built per-record,
 * not from a single hardcoded prefix, since it's the first entity with two
 * source post types sharing one target.
 */
const SOURCE_ENTITY_TYPE_PREFIX = "wordpress-db";

/** Raw taxonomy reference — no mapping to any mamaGo taxonomy/enum/discoverySignalId happens here. */
export interface NormalizedOfferSourceTerm {
  termId: number;
  taxonomy: string;
  name: string;
  slug: string;
}

export type OfferPlaceRelationStatus =
  | "NO_PLACE_RELATION"
  | "SINGLE_PLACE_RELATION"
  | "MULTIPLE_PLACE_RELATIONS";

/**
 * Evidence only — this normalizer never resolves a source Place post id to
 * a real `Place.id` (that needs a `MigrationLineage` lookup, i.e. a target
 * DB read, which is explicitly out of scope here — see
 * `src/lib/migration/place-resolution/types.ts`'s `RouteStopPlaceResolver`
 * for the async resolver shape a later commit-context PR would use) and
 * never picks a "primary" relation when there's more than one.
 * `placeSourcePostIds` preserves the repository's own deterministic order
 * (`relation_side`, `relation_order`, `related_post_id` — see
 * `buildOfferPlaceRelationsQuery`) rather than re-sorting by any assumed
 * priority.
 */
export interface NormalizedOfferPlaceRelationEvidence {
  status: OfferPlaceRelationStatus;
  placeSourcePostIds: readonly number[];
  relations: readonly WordPressOfferPlaceRelationRow[];
}

export type OfferBookingSettingsSchemaVariant =
  | "CALENDAR_ADDITIONS"
  | "PRODUCT_TABLE_BOOKING"
  | "UNKNOWN";

/**
 * `program-booking-settings` evidence only. Live inspection (2026-07-14)
 * found at least two distinct real shapes for this JSON — a
 * `calendar`+`additions` per-slot-price variant, and a `product_type:
 * "table"` + `booking.timeslots.groups` variant — richer than the flat
 * `OfferSession` (startAt/endAt/capacity/price) target model can represent
 * losslessly. `OfferSession` rows are never created from this; that's an
 * explicit, separate product decision for a later PR, not this one's to make.
 */
export interface NormalizedOfferBookingEvidence {
  raw: string | null;
  /** `null` when `raw` is `null` or not valid JSON — never partially repaired. */
  parsed: Record<string, unknown> | null;
  /** `null` only when `raw` is `null`; `"UNKNOWN"` for valid-but-unrecognized JSON shapes. */
  schemaVariant: OfferBookingSettingsSchemaVariant | null;
}

/**
 * `program-age` term evidence. `parsedMonths` is populated only when the
 * term's own numeric range (parsed from its Russian label, e.g. "7-9 лет",
 * "до года", "12+") matches an existing `AGE_OPTIONS` bucket from
 * `src/lib/config/ages.ts` *exactly* (same min/max years) — this project's
 * one official age policy, never a boundary invented here. WP's six real
 * `program-age` terms do not all line up with it (confirmed 2026-07-14):
 * "до года" and "7-9 лет" match exactly; "1-3 года" matches; "4-6 лет",
 * "10-12 лет", and "12+" do not correspond to any single official bucket
 * and are deliberately left unmatched rather than assigned to the nearest one.
 */
export interface NormalizedOfferAgeTermEvidence {
  termId: number;
  slug: string;
  name: string;
  parsedMonths: { minMonths: number; maxMonths: number | null } | null;
}

/** Only source post types Offer's shared bundle actually carries — see `WordPressOfferBundle`. */
export type NormalizedOfferSourcePostType = "hb-programs" | "services";

/**
 * A number this normalizer is confident it read correctly, alongside the
 * untouched source text — so a later reviewer can see exactly what failed
 * to parse without re-fetching from WordPress.
 */
export interface NormalizedOfferNumericEvidence {
  raw: string | null;
  parsed: number | null;
}

/**
 * Everything this normalizer is confident about extracting verbatim from a
 * `WordPressOfferBundle`. Deliberately contains no target-model decisions:
 * no `productType`/`kind`/`category` classification (CAMP vs PARTY_SERVICE
 * vs PARTY_PACKAGE is a product-content judgment call this layer cannot and
 * must not make — `hb-programs` is WordPress's own post-type slug, not
 * evidence of which mamaGo `OfferProductType` a given program belongs to),
 * no `OfferSession` rows, no `discoverySignalIds`, no resolved `placeId`.
 * `classificationStatus` stays `"UNCLASSIFIED"` for every candidate this
 * normalizer produces.
 */
export interface NormalizedOfferCandidate {
  // --- Identity ---
  sourceRecordKey: string;
  sourcePostId: number;
  sourcePostType: NormalizedOfferSourcePostType;
  sourceStatus: string;
  legacyAuthorId: number;
  publishedAt: string;
  modifiedAt: string;

  // --- Content ---
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  /** `short-description` (hb-programs) or `short-description-service` (services), whichever is present. */
  shortDescription: string | null;

  // --- Commercial evidence ---
  /** `program-cost`, HTML-stripped to plain text — the only field this normalizer cleans; everything else stays raw. */
  priceText: string | null;
  /** `program-cost` untouched, alongside the cleaned version above. */
  priceTextRaw: string | null;
  averageCheck: NormalizedOfferNumericEvidence;
  durationMinutes: NormalizedOfferNumericEvidence;
  maxGuests: NormalizedOfferNumericEvidence;

  // --- Classification evidence (never a decision) ---
  classificationStatus: "UNCLASSIFIED";
  sourceTerms: readonly NormalizedOfferSourceTerm[];

  // --- Relations ---
  placeRelation: NormalizedOfferPlaceRelationEvidence;

  // --- Booking ---
  booking: NormalizedOfferBookingEvidence;

  // --- Age ---
  ageTerms: readonly NormalizedOfferAgeTermEvidence[];

  // --- Media (source references only — nothing downloaded, no MediaAsset) ---
  media: {
    /** From `gallery`, deduped by exact value, order preserved. */
    galleryAttachmentIds: readonly number[];
    /** From `logo` (hb-programs) or `main-image-service` (services), whichever is present. */
    coverAttachmentId: number | null;
  };

  // --- SEO ---
  seo: {
    title: string | null;
    description: string | null;
    focusKeyword: string | null;
    canonicalUrl: string | null;
    robots: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
  };
  oldSlugs: readonly string[];

  /**
   * Full postmeta passthrough, keyed by meta_key. Covers every field this
   * normalizer doesn't lift into a named property above, so nothing is
   * silently dropped just because its exact key wasn't confirmed yet.
   */
  rawMeta: Readonly<Record<string, readonly string[]>>;
}

function firstMetaValue(postMeta: WordPressOfferBundle["postMeta"], key: string): string | null {
  return postMeta[key]?.[0] ?? null;
}

function firstNonNull(...values: readonly (string | null)[]): string | null {
  return values.find((v) => v !== null) ?? null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Non-negative finite numbers only — matches `average-check-program`/`hb-program-duration`/`max-guests-program`'s real observed shape (plain integer strings). */
function parseNonNegativeNumber(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toSourceTerm(term: WordPressTermRow): NormalizedOfferSourceTerm {
  return { termId: term.term_id, taxonomy: term.taxonomy, name: term.name, slug: term.slug };
}

function parseAttachmentId(raw: string | null): { id: number | null; invalidRaw?: string } {
  if (raw === null || raw.trim() === "") return { id: null };
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n <= 0) return { id: null, invalidRaw: raw };
  return { id: n };
}

/**
 * `gallery` was confirmed live (2026-07-14) as a single comma-separated
 * attachment-id string (same shape as Route's `images-location-N`, not
 * Place's repeated-meta-row `gallery`) — but this also folds in any
 * additional `gallery` meta rows if present, so it degrades safely either
 * way instead of assuming one exact shape. Exact-value dedup only, order
 * preserved (first occurrence wins), same as `normalizeEvent.ts`'s
 * `parseAttachmentIds`.
 */
function parseGalleryAttachmentIds(
  values: readonly string[] | undefined,
): { ids: number[]; invalidRaw: string[] } {
  const ids: number[] = [];
  const invalidRaw: string[] = [];
  for (const value of values ?? []) {
    for (const part of value.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const parsed = parseAttachmentId(trimmed);
      if (parsed.id !== null) ids.push(parsed.id);
      else if (parsed.invalidRaw !== undefined) invalidRaw.push(parsed.invalidRaw);
    }
  }
  return { ids: [...new Set(ids)], invalidRaw };
}

function parseBookingSettings(raw: string | null): {
  parsed: Record<string, unknown> | null;
  schemaVariant: OfferBookingSettingsSchemaVariant | null;
  malformed: boolean;
} {
  if (raw === null) return { parsed: null, schemaVariant: null, malformed: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { parsed: null, schemaVariant: null, malformed: true };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { parsed: null, schemaVariant: null, malformed: true };
  }

  const record = parsed as Record<string, unknown>;
  let schemaVariant: OfferBookingSettingsSchemaVariant;
  if ("calendar" in record) {
    schemaVariant = "CALENDAR_ADDITIONS";
  } else if ("booking" in record || "product_type" in record) {
    schemaVariant = "PRODUCT_TABLE_BOOKING";
  } else {
    schemaVariant = "UNKNOWN";
  }

  return { parsed: record, schemaVariant, malformed: false };
}

/**
 * Parses a `program-age` term's Russian label into a years range —
 * "до года" -> {0,1}, "X-Y лет"/"X-Y года" -> {X,Y}, "N+" -> {N, null}.
 * Returns `null` for anything else. This only reads the number(s) already
 * present in the label; it never invents a boundary.
 */
function parseAgeTermYears(name: string): { minYears: number; maxYears: number | null } | null {
  const trimmed = name.trim().toLowerCase();
  if (trimmed === "до года") return { minYears: 0, maxYears: 1 };

  const range = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)\s*(лет|года|год)?$/u);
  if (range) {
    return { minYears: Number(range[1]), maxYears: Number(range[2]) };
  }

  const openEnded = trimmed.match(/^(\d+)\s*\+$/u);
  if (openEnded) {
    return { minYears: Number(openEnded[1]), maxYears: null };
  }

  return null;
}

/** Exact match only against this project's one official age policy (`src/lib/config/ages.ts`) — no nearest-bucket guessing. */
function matchOfficialAgeMonths(
  years: { minYears: number; maxYears: number | null },
): { minMonths: number; maxMonths: number | null } | null {
  const match = AGE_OPTIONS.find((option) => option.min === years.minYears && option.max === years.maxYears);
  if (!match) return null;
  return { minMonths: match.minMonths, maxMonths: match.maxMonths };
}

function buildAgeTermsEvidence(terms: readonly WordPressTermRow[]): {
  ageTerms: NormalizedOfferAgeTermEvidence[];
  warnings: MigrationWarning[];
} {
  const ageTerms: NormalizedOfferAgeTermEvidence[] = [];
  const warnings: MigrationWarning[] = [];

  for (const term of terms) {
    if (term.taxonomy !== "program-age") continue;
    const years = parseAgeTermYears(term.name);
    const parsedMonths = years ? matchOfficialAgeMonths(years) : null;
    ageTerms.push({ termId: term.term_id, slug: term.slug, name: term.name, parsedMonths });
    if (parsedMonths === null) {
      warnings.push({
        code: "OFFER_AGE_TERM_UNKNOWN",
        message: `program-age term "${term.name}" (${term.slug}) does not match an exact bucket in the official age policy — kept as evidence only.`,
        severity: "INFO",
      });
    }
  }

  return { ageTerms, warnings };
}

function buildPlaceRelationEvidence(
  relations: readonly WordPressOfferPlaceRelationRow[],
): { evidence: NormalizedOfferPlaceRelationEvidence; warnings: MigrationWarning[] } {
  const warnings: MigrationWarning[] = [];
  const placeSourcePostIds = relations.map((r) => r.related_post_id);

  let status: OfferPlaceRelationStatus;
  if (relations.length === 0) {
    status = "NO_PLACE_RELATION";
    warnings.push({
      code: "OFFER_NO_PLACE_RELATION",
      message: "No wp_voxel_relations row links this Offer source to any places post.",
      severity: "INFO",
    });
  } else if (relations.length === 1) {
    status = "SINGLE_PLACE_RELATION";
  } else {
    status = "MULTIPLE_PLACE_RELATIONS";
    warnings.push({
      code: "OFFER_MULTIPLE_PLACE_RELATIONS",
      message: `${relations.length} places relations found; no primary marker in the source to pick one automatically — needs editorial review.`,
      severity: "WARNING",
      details: { placeSourcePostIds },
    });
  }

  return { evidence: { status, placeSourcePostIds, relations }, warnings };
}

export function normalizeOffer(bundle: WordPressOfferBundle): NormalizedRecord {
  const { post, postMeta, terms, placeRelations } = bundle;
  const sourcePostType = post.post_type as NormalizedOfferSourcePostType;
  const sourceRecordKey = buildOfferSourceRecordKey(post);
  const sourceEntityType = `${SOURCE_ENTITY_TYPE_PREFIX}:${sourcePostType}`;
  const warnings: MigrationWarning[] = [];

  if (post.post_title.trim() === "") {
    warnings.push({
      code: "OFFER_MISSING_TITLE",
      message: "post_title is empty.",
      severity: "WARNING",
      sourceRecordKey,
    });
  }

  if (sourcePostType === "services") {
    warnings.push({
      code: "OFFER_SERVICES_MANUAL_REVIEW",
      message: "services source type is not batch-classified — always requires manual editorial review before publish.",
      severity: "INFO",
      sourceRecordKey,
    });
  }

  // --- Commercial evidence ---
  const priceTextRaw = firstMetaValue(postMeta, "program-cost");
  const priceText = priceTextRaw ? stripHtml(priceTextRaw) : null;

  const averageCheckRaw = firstMetaValue(postMeta, "average-check-program");
  const averageCheckParsed = parseNonNegativeNumber(averageCheckRaw);
  if (averageCheckRaw !== null && averageCheckParsed === null) {
    warnings.push({
      code: "OFFER_PRICE_INVALID",
      message: `average-check-program value "${averageCheckRaw}" is not a valid non-negative number.`,
      severity: "WARNING",
      sourceRecordKey,
      details: { raw: averageCheckRaw },
    });
  }

  const durationRaw = firstMetaValue(postMeta, "hb-program-duration");
  const durationParsed = parseNonNegativeNumber(durationRaw);
  if (durationRaw !== null && durationParsed === null) {
    warnings.push({
      code: "OFFER_DURATION_INVALID",
      message: `hb-program-duration value "${durationRaw}" is not a valid non-negative number.`,
      severity: "WARNING",
      sourceRecordKey,
      details: { raw: durationRaw },
    });
  }

  const maxGuestsRaw = firstMetaValue(postMeta, "max-guests-program");
  const maxGuestsParsed = parseNonNegativeNumber(maxGuestsRaw);
  if (maxGuestsRaw !== null && maxGuestsParsed === null) {
    warnings.push({
      code: "OFFER_MAX_GUESTS_INVALID",
      message: `max-guests-program value "${maxGuestsRaw}" is not a valid non-negative number.`,
      severity: "WARNING",
      sourceRecordKey,
      details: { raw: maxGuestsRaw },
    });
  }

  // --- Place relation evidence ---
  const { evidence: placeRelation, warnings: placeWarnings } = buildPlaceRelationEvidence(placeRelations);
  warnings.push(...placeWarnings.map((w) => ({ ...w, sourceRecordKey })));

  // --- Booking evidence ---
  const bookingRaw = firstMetaValue(postMeta, "program-booking-settings");
  const bookingResult = parseBookingSettings(bookingRaw);
  if (bookingResult.malformed) {
    warnings.push({
      code: "OFFER_BOOKING_JSON_MALFORMED",
      message: "program-booking-settings is not valid JSON — kept as raw string only.",
      severity: "WARNING",
      sourceRecordKey,
      details: { raw: bookingRaw },
    });
  } else if (bookingResult.schemaVariant === "UNKNOWN") {
    warnings.push({
      code: "OFFER_BOOKING_SCHEMA_UNKNOWN",
      message: "program-booking-settings is valid JSON but does not match a known schema variant.",
      severity: "INFO",
      sourceRecordKey,
    });
  }

  // --- Age evidence ---
  const { ageTerms, warnings: ageWarnings } = buildAgeTermsEvidence(terms);
  warnings.push(...ageWarnings.map((w) => ({ ...w, sourceRecordKey })));

  // --- Media evidence ---
  const { ids: galleryAttachmentIds, invalidRaw: galleryInvalidRaw } = parseGalleryAttachmentIds(
    postMeta["gallery"],
  );
  const coverRaw = firstNonNull(firstMetaValue(postMeta, "logo"), firstMetaValue(postMeta, "main-image-service"));
  const { id: coverAttachmentId, invalidRaw: coverInvalidRaw } = parseAttachmentId(coverRaw);
  const mediaInvalidRaw = [...galleryInvalidRaw, ...(coverInvalidRaw ? [coverInvalidRaw] : [])];
  for (const invalid of mediaInvalidRaw) {
    warnings.push({
      code: "OFFER_MEDIA_ID_INVALID",
      message: `Media source value "${invalid}" is not a valid attachment id.`,
      severity: "WARNING",
      sourceRecordKey,
      details: { value: invalid },
    });
  }

  const mediaRefs = [
    ...(coverAttachmentId !== null ? [String(coverAttachmentId)] : []),
    ...galleryAttachmentIds.filter((id) => id !== coverAttachmentId).map((id) => String(id)),
  ];
  const relationRefs = terms.map((term) => `term:${term.taxonomy}:${term.slug}`);

  const normalizedPayload: NormalizedOfferCandidate = {
    sourceRecordKey,
    sourcePostId: post.ID,
    sourcePostType,
    sourceStatus: post.post_status,
    legacyAuthorId: post.post_author,
    publishedAt: post.post_date,
    modifiedAt: post.post_modified,

    title: post.post_title,
    slug: post.post_name,
    content: post.post_content,
    excerpt: post.post_excerpt,
    shortDescription: firstNonNull(
      firstMetaValue(postMeta, "short-description"),
      firstMetaValue(postMeta, "short-description-service"),
    ),

    priceText,
    priceTextRaw,
    averageCheck: { raw: averageCheckRaw, parsed: averageCheckParsed },
    durationMinutes: { raw: durationRaw, parsed: durationParsed },
    maxGuests: { raw: maxGuestsRaw, parsed: maxGuestsParsed },

    classificationStatus: "UNCLASSIFIED",
    sourceTerms: terms.map(toSourceTerm),

    placeRelation,

    booking: {
      raw: bookingRaw,
      parsed: bookingResult.parsed,
      schemaVariant: bookingResult.schemaVariant,
    },

    ageTerms,

    media: {
      galleryAttachmentIds,
      coverAttachmentId,
    },

    seo: {
      title: firstMetaValue(postMeta, "rank_math_title"),
      description: firstMetaValue(postMeta, "rank_math_description"),
      focusKeyword: firstMetaValue(postMeta, "rank_math_focus_keyword"),
      canonicalUrl: firstMetaValue(postMeta, "rank_math_canonical_url"),
      robots: firstMetaValue(postMeta, "rank_math_robots"),
      ogTitle: firstMetaValue(postMeta, "rank_math_facebook_title"),
      ogDescription: firstMetaValue(postMeta, "rank_math_facebook_description"),
    },
    oldSlugs: postMeta["_wp_old_slug"] ?? [],

    rawMeta: postMeta,
  };

  return {
    sourceRecordKey,
    sourceEntityType,
    targetTypeHint: "OFFER",
    normalizedPayload,
    mediaRefs,
    relationRefs,
    warnings,
  };
}

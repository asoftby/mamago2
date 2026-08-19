import { normalizePhoneToE164 } from "@/lib/phone/e164";
import type { OpeningHoursData } from "@/components/openingHours/openingHours.types";

import type { MigrationWarning, NormalizedRecord } from "../../types";
import { parsePlaceMediaAttachmentIds } from "./parsePlaceMediaAttachmentIds";
import { parsePlaceOpeningHours } from "./parsePlaceOpeningHours";
import type { WordPressPlaceBundle, WordPressTermRow } from "./types";

const SOURCE_ENTITY_TYPE = "wordpress-db:places";

/** Raw taxonomy reference — no mapping to any mamaGo taxonomy/enum happens here. */
export interface NormalizedPlaceSourceTerm {
  termId: number;
  taxonomy: string;
  name: string;
  slug: string;
}

/**
 * Everything this normalizer is confident about extracting verbatim from a
 * `WordPressPlaceBundle`. Ambiguous fields (`work_hours` format, `unp`
 * placement, category mapping) are deliberately left raw or omitted — see
 * `docs/migration/wordpress-to-mamago.md` "editor resolves ambiguity"
 * principle. Nothing here is downloaded, resolved, or committed.
 */
export interface NormalizedPlaceCandidate {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: string;
  publishedAt: string;
  modifiedAt: string;
  shortDescription: string | null;
  /** Raw WP `phone` postmeta value, unnormalized evidence — see `phoneE164` for the value safe to write to `Place.phone`. */
  phone: string | null;
  /**
   * `phone` run through the project's one canonical E.164 normalizer
   * (`src/lib/phone/e164.ts`). `null` when `phone` is empty, or when it's
   * non-empty but can't be resolved to a valid number — never a
   * best-effort/garbage value. See `PLACE_PHONE_INVALID` warning for the
   * latter case; `phone` above still preserves exactly what the source had.
   */
  phoneE164: string | null;
  email: string | null;
  workHoursRaw: string | null;
  /**
   * `workHoursRaw` run through `parsePlaceOpeningHours()`. `null` when
   * there is no usable schedule (missing source, invalid JSON, or every
   * day-group turned out unrepresentable) — see the `PLACE_WORK_HOURS_*`
   * warnings on this record for why. `workHoursRaw` above still preserves
   * exactly what the source had, regardless of whether this parses.
   */
  openingHours: OpeningHoursData | null;
  locationRaw: string | null;
  /**
   * `locationRaw` is the WP `location` postmeta's raw JSON string
   * (`{"address":...,"map_picker":...,"latitude":...,"longitude":...}`);
   * `addressText` is that blob's `address` field, parsed and trimmed —
   * mirrors the `phone`/`phoneE164` split (raw evidence vs. the value
   * safe to write to a target field). `null` when `location` is absent,
   * isn't valid JSON, its `address` is missing/empty (see
   * `PLACE_LOCATION_ADDRESS_UNPARSEABLE`), or the extracted text is a
   * content-free placeholder like "ул."/"улица" (see
   * `PLACE_ADDRESS_INCOMPLETE`) — never a best-effort/guessed value.
   */
  addressText: string | null;
  cityRaw: string | null;
  coordinates: { lat: number; lng: number } | null;
  media: {
    thumbnailAttachmentId: number | null;
    galleryAttachmentIds: readonly number[];
    logoAttachmentId?: number | null;
  };
  seo: {
    title: string | null;
    focusKeyword: string | null;
  };
  /** Raw taxonomy terms attached to the post. No category/target mapping applied. */
  sourceTerms: readonly NormalizedPlaceSourceTerm[];
  /**
   * Full postmeta passthrough, keyed by meta_key. Covers every field this
   * normalizer doesn't lift into a named property above (e.g. `unp` under
   * whatever meta_key the source actually uses, `booking-place-set`,
   * `claim-listing`) so nothing is silently dropped just because its exact
   * key wasn't confirmed yet.
   */
  rawMeta: Readonly<Record<string, readonly string[]>>;
}

function firstMetaValue(
  postMeta: WordPressPlaceBundle["postMeta"],
  key: string,
): string | null {
  return postMeta[key]?.[0] ?? null;
}

function toSourceTerm(term: WordPressTermRow): NormalizedPlaceSourceTerm {
  return { termId: term.term_id, taxonomy: term.taxonomy, name: term.name, slug: term.slug };
}

/**
 * WP's `location` postmeta is a JSON blob:
 * `{"address":"...","map_picker":bool,"latitude":n,"longitude":n}`
 * (coordinates come from `wp_voxel_index_places` instead — see
 * `hasCoordinates` above — this only extracts the free-text address).
 * `null` for anything that isn't a parseable object with a non-empty
 * `address` string — never a guessed/best-effort value.
 */
function resolvePlaceAddressText(locationRaw: string | null): string | null {
  if (!locationRaw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(locationRaw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const address = (parsed as Record<string, unknown>).address;
  if (typeof address !== "string") return null;
  const trimmed = address.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Legacy WP address text that carries no real location information: empty,
 * punctuation-only, or a bare street-type word with nothing after it (e.g.
 * "Ул." — Place 895's real source value). Deliberately narrow — only the
 * documented Russian street-type tokens, never a general junk detector —
 * so a genuine multi-word address is never mistaken for a placeholder.
 */
const ADDRESS_PLACEHOLDER_TOKENS = new Set(["ул", "улица"]);

function isPlaceholderOnlyAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase().replace(/\.+$/, "").trim();
  if (normalized.length === 0) return true;
  if (!/[\p{L}\p{N}]/u.test(normalized)) return true;
  return ADDRESS_PLACEHOLDER_TOKENS.has(normalized);
}

export function normalizePlace(bundle: WordPressPlaceBundle): NormalizedRecord {
  const { post, postMeta, terms, placeIndex } = bundle;
  const sourceRecordKey = `${SOURCE_ENTITY_TYPE}:${post.ID}`;
  const warnings: MigrationWarning[] = [];

  const hasCoordinates =
    placeIndex != null && placeIndex.lat !== null && placeIndex.lng !== null;
  const coordinates = hasCoordinates
    ? { lat: placeIndex!.lat as number, lng: placeIndex!.lng as number }
    : null;
  if (!coordinates) {
    warnings.push({
      code: "PLACE_MISSING_COORDINATES",
      message: "No wp_voxel_index_places row (or _location value) for this place.",
      severity: "WARNING",
      sourceRecordKey,
    });
  }

  const locationRaw = firstMetaValue(postMeta, "location");
  const extractedAddressText = resolvePlaceAddressText(locationRaw);
  if (locationRaw && !extractedAddressText) {
    warnings.push({
      code: "PLACE_LOCATION_ADDRESS_UNPARSEABLE",
      message: "location postmeta is present but its address could not be extracted (not valid JSON, or address is missing/empty).",
      severity: "WARNING",
      sourceRecordKey,
      details: { locationRaw },
    });
  }
  const addressText =
    extractedAddressText && !isPlaceholderOnlyAddress(extractedAddressText) ? extractedAddressText : null;
  if (extractedAddressText && !addressText) {
    warnings.push({
      code: "PLACE_ADDRESS_INCOMPLETE",
      message:
        "location.address parsed but is a content-free placeholder (empty, punctuation-only, or a bare street-type word like \"ул\"/\"ул.\"/\"улица\") — never written to the target address field. Needs manual review.",
      severity: "WARNING",
      sourceRecordKey,
      details: { extractedAddressText },
    });
  }

  const phoneRaw = firstMetaValue(postMeta, "phone");
  const phoneE164Resolved = phoneRaw ? normalizePhoneToE164(phoneRaw) : "";
  const phoneE164 = phoneE164Resolved || null;
  if (phoneRaw && !phoneE164Resolved) {
    warnings.push({
      code: "PLACE_PHONE_INVALID",
      message: "phone postmeta value could not be resolved to a valid E.164 number.",
      severity: "WARNING",
      sourceRecordKey,
      details: { phoneRaw },
    });
  }

  const logoValues = postMeta["logo"];
  const logoParsed = parsePlaceMediaAttachmentIds(logoValues);
  const logoAttachmentId = logoParsed.ids[0] ?? null;
  if (logoValues && logoValues.length > 0 && logoAttachmentId === null) {
    warnings.push({
      code: "PLACE_LOGO_UNPARSEABLE",
      message: "Source has a logo reference that could not be parsed as an attachment id; not imported.",
      severity: "WARNING",
      sourceRecordKey,
      details: { logoValues, invalidTokens: logoParsed.invalidTokens },
    });
  } else if (logoAttachmentId !== null) {
    warnings.push({
      code: "PLACE_LOGO_PRESENT",
      message: "Source has a logo attachment; FULL import will create PlaceImage(kind: LOGO) and set Place.logoImageId.",
      severity: "INFO",
      sourceRecordKey,
      details: { logoAttachmentId },
    });
  }

  const workHoursRaw = firstMetaValue(postMeta, "work_hours");
  const parsedOpeningHours = parsePlaceOpeningHours(workHoursRaw);
  for (const warning of parsedOpeningHours.warnings) {
    warnings.push({ ...warning, severity: "WARNING", sourceRecordKey });
  }

  // `cover` is the real primary meta key (confirmed 2026-07-15 against all
  // 82 published Places — 61/82 have it). `_thumbnail_id` never appears in
  // real data (0/82) but stays a documented fallback: if `cover` is ever
  // absent while `_thumbnail_id` is present, it's used and flagged; if
  // both are present and disagree, `cover` (primary) wins and the
  // disagreement is flagged rather than silently picking one.
  //
  // "Absent" here means the `cover` meta row itself doesn't exist —
  // deliberately checked separately from "parsed to zero valid ids", so a
  // *present but malformed* `cover` value (e.g. `"abc"`) never silently
  // falls through to the fallback. That would misreport a broken primary
  // as a clean absent-primary substitution; the malformed value already
  // surfaces via `PLACE_MEDIA_ID_INVALID` below and is left unresolved
  // for review instead.
  const coverKeyPresent = (postMeta["cover"]?.length ?? 0) > 0;
  const coverParsed = parsePlaceMediaAttachmentIds(postMeta["cover"]);
  const thumbnailFallbackParsed = parsePlaceMediaAttachmentIds(postMeta["_thumbnail_id"]);
  const galleryParsed = parsePlaceMediaAttachmentIds(postMeta["gallery"]);

  const primaryCoverId = coverParsed.ids[0] ?? null;
  const fallbackCoverId = thumbnailFallbackParsed.ids[0] ?? null;

  let thumbnailAttachmentId = primaryCoverId;
  if (!coverKeyPresent && fallbackCoverId !== null) {
    thumbnailAttachmentId = fallbackCoverId;
    warnings.push({
      code: "PLACE_MEDIA_LEGACY_KEY_USED",
      message: "cover postmeta is absent; used the documented _thumbnail_id fallback for the cover attachment.",
      severity: "INFO",
      sourceRecordKey,
      details: { legacyKey: "_thumbnail_id", attachmentId: fallbackCoverId, merged: true },
    });
  } else if (primaryCoverId !== null && fallbackCoverId !== null && primaryCoverId !== fallbackCoverId) {
    warnings.push({
      code: "PLACE_MEDIA_COVER_CONFLICT",
      message: "cover and _thumbnail_id postmeta are both present but disagree; cover (primary) is used.",
      severity: "WARNING",
      sourceRecordKey,
      details: { coverAttachmentId: primaryCoverId, thumbnailAttachmentId: fallbackCoverId },
    });
  }

  const galleryAttachmentIds = galleryParsed.ids;

  const invalidMediaTokens = [
    ...coverParsed.invalidTokens.map((token) => ({ field: "cover", token })),
    ...thumbnailFallbackParsed.invalidTokens.map((token) => ({ field: "_thumbnail_id", token })),
    ...galleryParsed.invalidTokens.map((token) => ({ field: "gallery", token })),
    ...logoParsed.invalidTokens.map((token) => ({ field: "logo", token })),
  ];
  if (invalidMediaTokens.length > 0) {
    warnings.push({
      code: "PLACE_MEDIA_ID_INVALID",
      message: "One or more media attachment id tokens could not be parsed; they were dropped, never guessed.",
      severity: "WARNING",
      sourceRecordKey,
      details: { invalid: invalidMediaTokens },
    });
  }

  // `gallery-place`/`logo-place` are a legacy, structurally distinct field
  // pair (confirmed 2026-07-15 on the one real case, Place 437: its
  // `gallery-place` ids don't overlap at all with its `gallery` ids — a
  // genuinely separate set, not an alternate name for the same data).
  // Preserved as raw evidence + a review warning only — never merged into
  // `galleryAttachmentIds`/`thumbnailAttachmentId`, since blending two
  // unreviewed, non-overlapping image sets could silently produce a wrong
  // combined gallery. `rawMeta` below still carries the raw values either way.
  const legacyGalleryPlaceValues = postMeta["gallery-place"];
  if (legacyGalleryPlaceValues && legacyGalleryPlaceValues.length > 0) {
    warnings.push({
      code: "PLACE_MEDIA_LEGACY_KEY_USED",
      message: "Source has a legacy gallery-place value distinct from gallery; kept as raw evidence, not merged into the imported gallery.",
      severity: "INFO",
      sourceRecordKey,
      details: { legacyKey: "gallery-place", rawValues: legacyGalleryPlaceValues, merged: false },
    });
  }
  const legacyLogoPlaceValues = postMeta["logo-place"];
  if (legacyLogoPlaceValues && legacyLogoPlaceValues.length > 0) {
    warnings.push({
      code: "PLACE_MEDIA_LEGACY_KEY_USED",
      message: "Source has a legacy logo-place value; kept as raw evidence, not merged into Place.logoImageId.",
      severity: "INFO",
      sourceRecordKey,
      details: { legacyKey: "logo-place", rawValues: legacyLogoPlaceValues, merged: false },
    });
  }

  const mediaRefs = [
    ...(thumbnailAttachmentId !== null ? [String(thumbnailAttachmentId)] : []),
    ...galleryAttachmentIds.map((id) => String(id)),
    ...(logoAttachmentId !== null ? [String(logoAttachmentId)] : []),
  ];
  const relationRefs = terms.map((term) => `term:${term.taxonomy}:${term.slug}`);

  const normalizedPayload: NormalizedPlaceCandidate = {
    title: post.post_title,
    slug: post.post_name,
    content: post.post_content,
    excerpt: post.post_excerpt,
    status: post.post_status,
    publishedAt: post.post_date,
    modifiedAt: post.post_modified,
    shortDescription: firstMetaValue(postMeta, "short-desc-place"),
    phone: phoneRaw,
    phoneE164,
    email: firstMetaValue(postMeta, "email"),
    workHoursRaw,
    openingHours: parsedOpeningHours.data,
    locationRaw,
    addressText,
    cityRaw: firstMetaValue(postMeta, "city-place"),
    coordinates,
    media: {
      thumbnailAttachmentId,
      galleryAttachmentIds,
      logoAttachmentId,
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
    targetTypeHint: "PLACE",
    normalizedPayload,
    mediaRefs,
    relationRefs,
    warnings,
  };
}

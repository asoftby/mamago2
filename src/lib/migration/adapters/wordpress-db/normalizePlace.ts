import { normalizePhoneToE164 } from "@/lib/phone/e164";
import type { OpeningHoursData } from "@/components/openingHours/openingHours.types";

import type { MigrationWarning, NormalizedRecord } from "../../types";
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
  cityRaw: string | null;
  coordinates: { lat: number; lng: number } | null;
  media: {
    thumbnailAttachmentId: number | null;
    galleryAttachmentIds: readonly number[];
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

function parseAttachmentId(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAttachmentIds(values: readonly string[] | undefined): number[] {
  if (!values) return [];
  return values
    .map((value) => parseAttachmentId(value))
    .filter((value): value is number => value !== null);
}

function toSourceTerm(term: WordPressTermRow): NormalizedPlaceSourceTerm {
  return { termId: term.term_id, taxonomy: term.taxonomy, name: term.name, slug: term.slug };
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
  if (logoValues && logoValues.length > 0) {
    warnings.push({
      code: "PLACE_LOGO_EXCLUDED",
      message:
        "Source has a logo reference; logos are never auto-imported (see wordpress-to-mamago.md addendum). Not included in media refs.",
      severity: "INFO",
      sourceRecordKey,
      details: { logoAttachmentIds: logoValues },
    });
  }

  const workHoursRaw = firstMetaValue(postMeta, "work_hours");
  const parsedOpeningHours = parsePlaceOpeningHours(workHoursRaw);
  for (const warning of parsedOpeningHours.warnings) {
    warnings.push({ ...warning, severity: "WARNING", sourceRecordKey });
  }

  const thumbnailAttachmentId = parseAttachmentId(firstMetaValue(postMeta, "_thumbnail_id"));
  const galleryAttachmentIds = parseAttachmentIds(postMeta["gallery"]);

  const mediaRefs = [
    ...(thumbnailAttachmentId !== null ? [String(thumbnailAttachmentId)] : []),
    ...galleryAttachmentIds.map((id) => String(id)),
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
    locationRaw: firstMetaValue(postMeta, "location"),
    cityRaw: firstMetaValue(postMeta, "city-place"),
    coordinates,
    media: {
      thumbnailAttachmentId,
      galleryAttachmentIds,
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

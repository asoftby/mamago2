import type { MigrationWarning, NormalizedRecord } from "../../types";
import type { WordPressEventBundle, WordPressTermRow } from "./types";

const SOURCE_ENTITY_TYPE = "wordpress-db:events";

/** Raw taxonomy reference — no mapping to any mamaGo taxonomy/enum happens here. */
export interface NormalizedEventSourceTerm {
  termId: number;
  taxonomy: string;
  name: string;
  slug: string;
}

/**
 * A schedule this normalizer is confident enough to call unambiguous:
 * every raw `event_date` value parsed to a real timestamp. `ONE_TIME` for
 * exactly one date, `MULTI_DATE` for more than one. `RECURRING`/`ON_DEMAND`/
 * `ALWAYS` (the other `ScheduleMode` values) are never inferred here — that
 * would require actually understanding WP's recurrence representation,
 * which is a later PR's problem, not this one's.
 */
export interface NormalizedEventScheduleDraft {
  mode: "ONE_TIME" | "MULTI_DATE";
  /** ISO 8601 date-times, one per successfully parsed `event_date` value. */
  dates: readonly string[];
}

/**
 * Everything this normalizer is confident about extracting verbatim from a
 * `WordPressEventBundle`. Deliberately excluded, per the PR16 scope
 * decisions: event images (no thumbnail/gallery attachment ids are read at
 * all — this candidate has no `media` field), category/occasion mapping,
 * organizer resolution, and Place linking. Venue/location/city stay raw
 * text for a later PR to resolve manually or via lookup, exactly like
 * `NormalizedPlaceCandidate.locationRaw`/`cityRaw`. Nothing here is
 * downloaded, resolved, or committed.
 */
export interface NormalizedEventCandidate {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: string;
  publishedAt: string;
  modifiedAt: string;
  /** Raw `event_date` postmeta values, unparsed, in source order. */
  eventDatesRaw: readonly string[];
  /** `null` whenever any `event_date` value didn't parse unambiguously, or none exist — see the matching warning. */
  scheduleDraft: NormalizedEventScheduleDraft | null;
  /** From `event-place-name` — a venue name, not an `Organizer`. */
  venueNameRaw: string | null;
  /** From `location`. */
  locationRaw: string | null;
  /** From `adress-event-place` (WP's own key, typo preserved) — kept separate from `locationRaw` rather than merged, since which one is authoritative isn't confirmed. */
  addressEventPlaceRaw: string | null;
  /** From `event_city`. */
  cityRaw: string | null;
  /** From `event-cost`, HTML-stripped to plain text. No pricing model is built — see `Activity.priceText`/`priceDetails` for that, later. */
  priceRaw: string | null;
  /** From `url-buy-ticket`. Final placement (`Activity` field vs elsewhere) is not decided here. */
  ticketUrlRaw: string | null;
  /** From `external_event_id`. */
  externalEventId: string | null;
  /** From `external_last_updated`, unparsed. */
  externalLastUpdatedRaw: string | null;
  /** From `trailer-url`. */
  trailerUrlRaw: string | null;
  seo: {
    title: string | null;
    focusKeyword: string | null;
  };
  /** Raw taxonomy terms (category/occasion candidates included) attached to the post. No mapping applied. */
  sourceTerms: readonly NormalizedEventSourceTerm[];
  /**
   * Full postmeta passthrough, keyed by meta_key. Covers every field this
   * normalizer doesn't lift into a named property above, so nothing is
   * silently dropped just because its exact key wasn't confirmed yet.
   */
  rawMeta: Readonly<Record<string, readonly string[]>>;
}

function firstMetaValue(postMeta: WordPressEventBundle["postMeta"], key: string): string | null {
  return postMeta[key]?.[0] ?? null;
}

function hasMeta(postMeta: WordPressEventBundle["postMeta"], key: string): boolean {
  return (postMeta[key]?.length ?? 0) > 0;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSourceTerm(term: WordPressTermRow): NormalizedEventSourceTerm {
  return { termId: term.term_id, taxonomy: term.taxonomy, name: term.name, slug: term.slug };
}

function parseEventDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Best-effort only: treats each raw `event_date` value as parseable if
 * `Date` can make sense of it verbatim. This hasn't been validated against
 * a real sample of WP's actual `event_date` storage format (likely a
 * serialized array from the Voxel events plugin) — real inspection should
 * refine this before any commit-stage PR relies on `scheduleDraft`.
 */
function buildScheduleDraft(
  rawValues: readonly string[],
  sourceRecordKey: string,
): { scheduleDraft: NormalizedEventScheduleDraft | null; warning: MigrationWarning | null } {
  if (rawValues.length === 0) {
    return {
      scheduleDraft: null,
      warning: {
        code: "EVENT_SCHEDULE_MISSING",
        message: "No event_date postmeta value found for this event.",
        severity: "WARNING",
        sourceRecordKey,
      },
    };
  }

  const parsedDates = rawValues.map(parseEventDate);
  if (parsedDates.some((date) => date === null)) {
    return {
      scheduleDraft: null,
      warning: {
        code: "EVENT_SCHEDULE_AMBIGUOUS",
        message:
          "One or more event_date values could not be parsed unambiguously; needs manual review before scheduling.",
        severity: "WARNING",
        sourceRecordKey,
        details: { eventDatesRaw: rawValues },
      },
    };
  }

  const dates = parsedDates as string[];
  return {
    scheduleDraft: { mode: dates.length === 1 ? "ONE_TIME" : "MULTI_DATE", dates },
    warning: null,
  };
}

export function normalizeEvent(bundle: WordPressEventBundle): NormalizedRecord {
  const { post, postMeta, terms } = bundle;
  const sourceRecordKey = `${SOURCE_ENTITY_TYPE}:${post.ID}`;
  const warnings: MigrationWarning[] = [];

  const eventDatesRaw = postMeta["event_date"] ?? [];
  const { scheduleDraft, warning: scheduleWarning } = buildScheduleDraft(eventDatesRaw, sourceRecordKey);
  if (scheduleWarning) {
    warnings.push(scheduleWarning);
  }

  const hasExcludedMedia = hasMeta(postMeta, "_thumbnail_id") || hasMeta(postMeta, "gallery");
  if (hasExcludedMedia) {
    warnings.push({
      code: "EVENT_MEDIA_EXCLUDED",
      message:
        "Source has thumbnail/gallery references; event images are never imported in Phoenix v1 (see wordpress-to-mamago.md). Not included in media refs.",
      severity: "INFO",
      sourceRecordKey,
    });
  }

  const relationRefs = terms.map((term) => `term:${term.taxonomy}:${term.slug}`);

  const rawPrice = firstMetaValue(postMeta, "event-cost");

  const normalizedPayload: NormalizedEventCandidate = {
    title: post.post_title,
    slug: post.post_name,
    content: post.post_content,
    excerpt: post.post_excerpt,
    status: post.post_status,
    publishedAt: post.post_date,
    modifiedAt: post.post_modified,
    eventDatesRaw,
    scheduleDraft,
    venueNameRaw: firstMetaValue(postMeta, "event-place-name"),
    locationRaw: firstMetaValue(postMeta, "location"),
    addressEventPlaceRaw: firstMetaValue(postMeta, "adress-event-place"),
    cityRaw: firstMetaValue(postMeta, "event_city"),
    priceRaw: rawPrice !== null ? stripHtml(rawPrice) || null : null,
    ticketUrlRaw: firstMetaValue(postMeta, "url-buy-ticket"),
    externalEventId: firstMetaValue(postMeta, "external_event_id"),
    externalLastUpdatedRaw: firstMetaValue(postMeta, "external_last_updated"),
    trailerUrlRaw: firstMetaValue(postMeta, "trailer-url"),
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
    targetTypeHint: "ACTIVITY",
    normalizedPayload,
    mediaRefs: [],
    relationRefs,
    warnings,
  };
}

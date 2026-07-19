import type { MigrationWarning, NormalizedRecord } from "../../types";
import { parseEventLocationRaw } from "./parseEventLocationRaw";
import type { ParsedEventLocation } from "./parseEventLocationRaw";
import { pruneEventScheduleToEligibleSessions } from "./pruneEventSchedule";
import type { WordPressEventBundle, WordPressTermRow } from "./types";

const SOURCE_ENTITY_TYPE = "wordpress-db:events";

/** Raw taxonomy reference — no mapping to any mamaGo taxonomy/enum happens here. */
export interface NormalizedEventSourceTerm {
  termId: number;
  taxonomy: string;
  name: string;
  slug: string;
  /** Lowercased, whitespace-normalized term name (for matchers downstream). */
  normalizedName?: string;
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
  /**
   * Local-date keys (`YYYY-MM-DD`) compatible with the existing
   * sessions-sync logic (`replaceActivitySessionsFromScheduleJson`).
   */
  dates: readonly string[];
  /**
   * Optional schedule items preserving date ranges (start/end) losslessly.
   * This is also compatible with `syncEventActivitySessions` which prefers
   * `scheduleItems` when present.
   */
  scheduleItems?: readonly {
    date: string;
    dateEnd?: string;
    /** `HH:mm` */
    startTime?: string;
  }[];
  /** Defaulted `HH:mm` when present in source. */
  startTime?: string;
}

/**
 * Everything this normalizer is confident about extracting verbatim from a
 * `WordPressEventBundle`. Media is source evidence only: attachment ids are
 * extracted from postmeta, but files are never downloaded and attachment
 * rows are never resolved here. Category/occasion mapping, organizer
 * resolution, and Place linking stay downstream responsibilities.
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
  /** From `location`, unparsed — either plain text or a JSON-object string (`{"address":...,"latitude":...,"longitude":...}`). Kept only as raw evidence; never copy this directly into `EventVenue.addressLine`, use `location` below instead. */
  locationRaw: string | null;
  /** `parseEventLocationRaw(locationRaw)`'s result — `null` when there's nothing usable (blank, or JSON-shaped with no valid address/coordinates). */
  location?: ParsedEventLocation | null;
  /** From `adress-event-place` (WP's own key, typo preserved) — kept separate from `locationRaw` rather than merged, since which one is authoritative isn't confirmed. */
  addressEventPlaceRaw: string | null;
  /** From `event_city`. */
  cityRaw: string | null;
  /**
   * Optional raw reference to a WP Place post id (if present in postmeta).
   * Used only by commit-context matching (via MigrationLineage), never here.
   */
  venuePlacePostIdRaw?: number | null;
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
   * Best-effort age evidence extracted from meta/terms/text. Does not decide
   * `Activity.ageTags` — that's commit-context matching.
   */
  ageEvidence?: {
    raw: string;
    parsed?: { minYears?: number; maxYears?: number };
    confidence: "MATCHED_HIGH" | "MATCHED_LOW" | "UNMATCHED";
    source: "meta" | "term" | "text";
  };
  /**
   * Full postmeta passthrough, keyed by meta_key. Covers every field this
   * normalizer doesn't lift into a named property above, so nothing is
   * silently dropped just because its exact key wasn't confirmed yet.
   */
  rawMeta: Readonly<Record<string, readonly string[]>>;
  media?: {
    featuredAttachmentId: number | null;
    galleryAttachmentIds: readonly number[];
  };
}

function firstMetaValue(postMeta: WordPressEventBundle["postMeta"], key: string): string | null {
  return postMeta[key]?.[0] ?? null;
}

function parseIntOrNull(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseAttachmentId(raw: string | null): { id: number | null; invalidRaw?: string } {
  if (raw === null || raw.trim() === "") return { id: null };
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n <= 0) return { id: null, invalidRaw: raw };
  return { id: n };
}

/**
 * Each `gallery` meta value is itself split on `,` before parsing — WordPress
 * sometimes stores the whole gallery as one comma-joined string in a single
 * meta row (confirmed live for `wordpress-db:events:60404`: `gallery` is one
 * row `"60407,60408,60409,60410"`) rather than one meta row per id. A plain
 * value with no comma splits to itself, so the separate-meta-row shape is
 * unaffected. One invalid token inside an otherwise-valid comma list no
 * longer discards the rest — each token is parsed independently.
 */
function parseAttachmentIds(
  values: readonly string[] | undefined,
): { ids: number[]; invalidRaw: string[]; hadValues: boolean } {
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
  return { ids: [...new Set(ids)], invalidRaw, hadValues: (values?.length ?? 0) > 0 };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSourceTerm(term: WordPressTermRow): NormalizedEventSourceTerm {
  const normalizedName = term.name ? term.name.toLowerCase().replace(/\s+/g, " ").trim() : "";
  return { termId: term.term_id, taxonomy: term.taxonomy, name: term.name, slug: term.slug, normalizedName: normalizedName || undefined };
}

function pickFirstNonEmpty(values: readonly string[] | undefined): string | null {
  if (!values) return null;
  for (const v of values) {
    const t = v.trim();
    if (t) return t;
  }
  return null;
}

type AgeEvidence = NonNullable<NormalizedEventCandidate["ageEvidence"]>;

function parseAgeEvidence(raw: string): AgeEvidence {
  const t = raw.trim();
  const lower = t.toLowerCase();

  const plus = lower.match(/(?:^|[^\d])(\d{1,2})\s*\+\s*(?:лет|год|года)?(?:$|\b)/);
  if (plus) {
    return { raw: t, parsed: { minYears: Number(plus[1]) }, confidence: "MATCHED_HIGH", source: "text" };
  }

  const range = lower.match(/(?:^|[^\d])(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(?:лет|год|года)?(?:$|\b)/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    const minYears = Math.min(a, b);
    const maxYears = Math.max(a, b);
    return { raw: t, parsed: { minYears, maxYears }, confidence: "MATCHED_HIGH", source: "text" };
  }

  const fromYears = lower.match(/от\s+(\d{1,2})\s*(?:лет|года|год)\b/);
  if (fromYears) {
    return { raw: t, parsed: { minYears: Number(fromYears[1]) }, confidence: "MATCHED_LOW", source: "text" };
  }

  const forKids = lower.match(/для\s+детей\s+(\d{1,2})\s*(?:лет|года|год)\b/);
  if (forKids) {
    return { raw: t, parsed: { minYears: Number(forKids[1]) }, confidence: "MATCHED_LOW", source: "text" };
  }

  const hasMalysh =
    /(?:^|[^\p{L}\p{N}])малыш(?:и|ей)?(?:$|[^\p{L}\p{N}])/u.test(lower) ||
    /(?:^|[^\p{L}\p{N}])для\s+малыш(?:и|ей)?(?:$|[^\p{L}\p{N}])/u.test(lower);
  if (hasMalysh) {
    return { raw: t, parsed: { maxYears: 3 }, confidence: "MATCHED_LOW", source: "text" };
  }

  return { raw: t, confidence: "UNMATCHED", source: "text" };
}

function extractAgeEvidence(args: {
  postMeta: WordPressEventBundle["postMeta"];
  sourceTerms: readonly NormalizedEventSourceTerm[];
  title: string;
  excerpt: string;
  content: string;
}): AgeEvidence | undefined {
  const { postMeta, sourceTerms, title, excerpt, content } = args;

  const metaCandidate =
    pickFirstNonEmpty(postMeta["age"] ?? postMeta["age_text"] ?? postMeta["ageRange"] ?? postMeta["age_range"] ?? postMeta["event_age"]);
  if (metaCandidate) {
    const parsed = parseAgeEvidence(metaCandidate);
    return { ...parsed, source: "meta" };
  }

  const termCandidate = sourceTerms
    .map((t) => t.name)
    .find((name) => typeof name === "string" && /(\d{1,2}\s*\+)|(\d{1,2}\s*[-–]\s*\d{1,2})|малыш/i.test(name));
  if (termCandidate) {
    const parsed = parseAgeEvidence(termCandidate);
    return { ...parsed, source: "term" };
  }

  const textHaystack = `${title}\n${excerpt}\n${stripHtml(content)}`.slice(0, 2000);
  const match =
    textHaystack.match(/(\d{1,2}\s*\+)|(\d{1,2}\s*[-–]\s*\d{1,2})|от\s+\d{1,2}\s*(?:лет|года|год)|для\s+детей\s+\d{1,2}\s*(?:лет|года|год)|малыш(и|ей)?/i);
  if (match?.[0]) {
    return parseAgeEvidence(match[0]);
  }

  return undefined;
}

function isLocalDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toLocalDateKey(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseWpDateTime(
  raw: string,
): { localDate: string; time: string | null } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Common WP/Voxel formats: "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD HH:mm"
  const m = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const hh = m[4] !== undefined ? Number(m[4]) : null;
  const mm = m[5] !== undefined ? Number(m[5]) : null;
  const time =
    hh !== null && mm !== null && Number.isFinite(hh) && Number.isFinite(mm)
      ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
      : null;

  const localDate = toLocalDateKey(year, month, day);
  return isLocalDateKey(localDate) ? { localDate, time } : null;
}

/**
 * Voxel stores `event_date` as a JSON array of `{ start, end, ... }` objects
 * inside a single postmeta row. Plain `YYYY-MM-DD HH:mm:ss` strings (one per
 * meta row) are also accepted for fixtures and any legacy rows.
 */
type ParsedEventDateItem = {
  startLocalDate: string;
  startTime: string | null;
  endLocalDate: string | null;
};

function compareLocalDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

function parseEventDateMetaValues(rawValues: readonly string[]): {
  items: ParsedEventDateItem[];
  dates: string[];
  startTime: string | null;
  warnings: MigrationWarning[];
} | null {
  const items: ParsedEventDateItem[] = [];
  const dates: string[] = [];
  const warnings: MigrationWarning[] = [];
  let firstStartTime: string | null = null;

  for (const raw of rawValues) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("[")) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return null;
      }
      if (!Array.isArray(parsed)) return null;

      for (const item of parsed) {
        if (typeof item !== "object" || item === null) return null;
        const start = (item as Record<string, unknown>).start;
        const end = (item as Record<string, unknown>).end;
        if (typeof start !== "string") return null;
        const parsedStart = parseWpDateTime(start);
        if (!parsedStart) return null;
        const parsedEnd =
          typeof end === "string" && end.trim()
            ? parseWpDateTime(end)
            : null;

        const endLocalDate = parsedEnd?.localDate ?? null;
        const startLocalDate = parsedStart.localDate;
        if (firstStartTime === null && parsedStart.time) {
          firstStartTime = parsedStart.time;
        }

        // Normalize bad ranges (end before start) into a safe order.
        if (endLocalDate && compareLocalDateKeys(endLocalDate, startLocalDate) < 0) {
          warnings.push({
            code: "EVENT_DATE_RANGE_NORMALIZED",
            message: "event_date end is before start; normalized by swapping the range bounds.",
            severity: "WARNING",
            details: { start, end },
          });
          items.push({
            startLocalDate: endLocalDate,
            startTime: parsedStart.time,
            endLocalDate: startLocalDate,
          });
          dates.push(endLocalDate);
          dates.push(startLocalDate);
        } else {
          items.push({
            startLocalDate,
            startTime: parsedStart.time,
            endLocalDate,
          });
          dates.push(startLocalDate);
          if (endLocalDate) dates.push(endLocalDate);
          if (!endLocalDate && typeof end === "string" && end.trim().length > 0) {
            warnings.push({
              code: "EVENT_END_DATE_MISSING",
              message: "event_date has an end value but it could not be parsed; using start only.",
              severity: "WARNING",
              details: { start, end },
            });
          }
        }
      }
      continue;
    }

    const parsedStart = parseWpDateTime(trimmed);
    if (!parsedStart) return null;
    if (firstStartTime === null && parsedStart.time) {
      firstStartTime = parsedStart.time;
    }
    items.push({ startLocalDate: parsedStart.localDate, startTime: parsedStart.time, endLocalDate: null });
    dates.push(parsedStart.localDate);
  }

  const uniqueSortedDates = [...new Set(dates)].sort(compareLocalDateKeys);
  return uniqueSortedDates.length > 0
    ? { items, dates: uniqueSortedDates, startTime: firstStartTime, warnings }
    : null;
}

function buildScheduleDraft(
  rawValues: readonly string[],
  sourceRecordKey: string,
): { scheduleDraft: NormalizedEventScheduleDraft | null; warnings: MigrationWarning[] } {
  if (rawValues.length === 0) {
    return {
      scheduleDraft: null,
      warnings: [
        {
        code: "EVENT_SCHEDULE_MISSING",
        message: "No event_date postmeta value found for this event.",
        severity: "WARNING",
        sourceRecordKey,
        },
      ],
    };
  }

  const parsed = parseEventDateMetaValues(rawValues);
  if (!parsed) {
    return {
      scheduleDraft: null,
      warnings: [
        {
        code: "EVENT_SCHEDULE_AMBIGUOUS",
        message:
          "One or more event_date values could not be parsed unambiguously; needs manual review before scheduling.",
        severity: "WARNING",
        sourceRecordKey,
        details: { eventDatesRaw: rawValues },
        },
      ],
    };
  }

  const scheduleItems = parsed.items.map((it) => ({
    date: it.startLocalDate,
    ...(it.endLocalDate && it.endLocalDate !== it.startLocalDate ? { dateEnd: it.endLocalDate } : {}),
    ...(it.startTime ? { startTime: it.startTime } : {}),
  }));

  return {
    scheduleDraft: {
      mode: parsed.items.length === 1 ? "ONE_TIME" : "MULTI_DATE",
      dates: parsed.dates,
      ...(scheduleItems.length > 0 ? { scheduleItems } : {}),
      ...(parsed.startTime ? { startTime: parsed.startTime } : {}),
    },
    warnings: parsed.warnings.map((w) => ({ ...w, sourceRecordKey })),
  };
}

/**
 * `options.now`, when provided, is the migration clock (Europe/Minsk local
 * day) used to prune past sessions out of a multi-date schedule and to
 * exclude past-only events entirely (Phoenix v1 scope: past Events are
 * never migrated — prelaunch-checklist §0.6). Omitted in most unit tests on
 * purpose: without a clock, no session is ever considered "past", so
 * `scheduleDraft` comes back exactly as parsed — real callers (the
 * wordpress-db adapter's `normalizeRecord`) always pass the run's `now`.
 */
export function normalizeEvent(bundle: WordPressEventBundle, options?: { now?: Date }): NormalizedRecord {
  const { post, postMeta, terms } = bundle;
  const sourceRecordKey = `${SOURCE_ENTITY_TYPE}:${post.ID}`;
  const warnings: MigrationWarning[] = [];

  const eventDatesRaw = postMeta["event_date"] ?? [];
  const { scheduleDraft: parsedScheduleDraft, warnings: scheduleWarnings } = buildScheduleDraft(eventDatesRaw, sourceRecordKey);
  warnings.push(...scheduleWarnings);

  let scheduleDraft = parsedScheduleDraft;
  if (scheduleDraft && options?.now) {
    const pruneResult = pruneEventScheduleToEligibleSessions({ scheduleDraft, now: options.now });
    if (!pruneResult.eligible) {
      scheduleDraft = null;
      warnings.push({
        code: "EVENT_PAST_ONLY_EXCLUDED",
        message:
          "Every event_date session is in the past relative to the migration clock; Phoenix v1 excludes past events entirely (see prelaunch-checklist §0.6).",
        severity: "WARNING",
        sourceRecordKey,
        details: { droppedPastDates: pruneResult.droppedPastDates },
      });
    } else {
      scheduleDraft = pruneResult.scheduleDraft;
      if (pruneResult.droppedPastDates.length > 0) {
        warnings.push({
          code: "EVENT_PAST_SESSIONS_PRUNED",
          message: "Past event_date sessions were dropped; only active/future sessions are kept for migration.",
          severity: "INFO",
          sourceRecordKey,
          details: {
            droppedPastDates: pruneResult.droppedPastDates,
            retainedDates: scheduleDraft.dates,
          },
        });
      }
      for (const clamp of pruneResult.clampedActiveRanges) {
        warnings.push({
          code: "EVENT_ACTIVE_RANGE_START_CLAMPED",
          message:
            "An active event_date range started in the past; its start was clamped to today's local date so past days are never materialized as sessions.",
          severity: "INFO",
          sourceRecordKey,
          details: {
            originalStartDate: clamp.originalStartDate,
            clampedStartDate: clamp.clampedStartDate,
            endDate: clamp.endDate,
            droppedPastDayCount: clamp.droppedPastDayCount,
          },
        });
      }
    }
  }

  const featured = parseAttachmentId(firstMetaValue(postMeta, "_thumbnail_id"));
  if (postMeta["_thumbnail_id"] && featured.id === null && featured.invalidRaw === undefined) {
    warnings.push({
      code: "EVENT_FEATURED_IMAGE_MISSING",
      message: "Source has an empty _thumbnail_id value; no featured event image can be imported.",
      severity: "INFO",
      sourceRecordKey,
    });
  }
  if (featured.invalidRaw !== undefined) {
    warnings.push({
      code: "EVENT_MEDIA_SOURCE_INVALID",
      message: "Source _thumbnail_id value is not a valid positive attachment id.",
      severity: "WARNING",
      sourceRecordKey,
      details: { field: "_thumbnail_id", value: featured.invalidRaw },
    });
  }

  const gallery = parseAttachmentIds(postMeta["gallery"]);
  if (gallery.hadValues && gallery.ids.length === 0 && gallery.invalidRaw.length === 0) {
    warnings.push({
      code: "EVENT_GALLERY_EMPTY",
      message: "Source gallery meta is present but contains no attachment ids.",
      severity: "INFO",
      sourceRecordKey,
    });
  }
  for (const invalid of gallery.invalidRaw) {
    warnings.push({
      code: "EVENT_MEDIA_SOURCE_INVALID",
      message: "Source gallery value is not a valid positive attachment id.",
      severity: "WARNING",
      sourceRecordKey,
      details: { field: "gallery", value: invalid },
    });
  }

  const mediaRefs = [
    ...(featured.id !== null ? [String(featured.id)] : []),
    ...gallery.ids.map((id) => String(id)),
  ].filter((ref, index, all) => all.indexOf(ref) === index);

  const relationRefs = terms.map((term) => `term:${term.taxonomy}:${term.slug}`);

  const rawPrice = firstMetaValue(postMeta, "event-cost");
  const venuePlacePostIdRaw = parseIntOrNull(
    firstMetaValue(postMeta, "event_place") ??
      firstMetaValue(postMeta, "event-place") ??
      firstMetaValue(postMeta, "event_place_id") ??
      firstMetaValue(postMeta, "place_id"),
  );

  const locationRaw = firstMetaValue(postMeta, "location");
  const { location, invalidJsonLike: locationJsonInvalid } = parseEventLocationRaw(locationRaw);
  if (locationJsonInvalid) {
    warnings.push({
      code: "EVENT_LOCATION_JSON_INVALID",
      message: "location postmeta looks like a JSON object but could not be parsed; address/coordinates evidence is unavailable.",
      severity: "WARNING",
      sourceRecordKey,
    });
  }

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
    locationRaw,
    location,
    addressEventPlaceRaw: firstMetaValue(postMeta, "adress-event-place"),
    cityRaw: firstMetaValue(postMeta, "event_city"),
    venuePlacePostIdRaw,
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
    media: {
      featuredAttachmentId: featured.id,
      galleryAttachmentIds: gallery.ids,
    },
    rawMeta: postMeta,
  };

  const ageEvidence = extractAgeEvidence({
    postMeta,
    sourceTerms: normalizedPayload.sourceTerms,
    title: normalizedPayload.title,
    excerpt: normalizedPayload.excerpt,
    content: normalizedPayload.content,
  });
  if (ageEvidence) {
    normalizedPayload.ageEvidence = ageEvidence;
    if (ageEvidence.confidence === "UNMATCHED") {
      warnings.push({
        code: "EVENT_AGE_UNMATCHED",
        message: `Age evidence "${ageEvidence.raw}" could not be parsed confidently.`,
        severity: "WARNING",
        sourceRecordKey,
        details: { raw: ageEvidence.raw, source: ageEvidence.source },
      });
    } else if (ageEvidence.confidence === "MATCHED_LOW") {
      warnings.push({
        code: "EVENT_AGE_LOW_CONFIDENCE",
        message: `Age evidence "${ageEvidence.raw}" parsed with low confidence.`,
        severity: "WARNING",
        sourceRecordKey,
        details: ageEvidence,
      });
    }
  }

  return {
    sourceRecordKey,
    sourceEntityType: SOURCE_ENTITY_TYPE,
    targetTypeHint: "ACTIVITY",
    normalizedPayload,
    mediaRefs,
    relationRefs,
    warnings,
  };
}

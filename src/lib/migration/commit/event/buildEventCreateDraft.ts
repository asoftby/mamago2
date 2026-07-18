import type {
  EventCommitBlockReason,
  EventCommitContext,
  EventCreateDraft,
  EventCreateDraftResult,
  EventVenueDraft,
  NormalizedEventCandidate,
} from "./types";

const SHORT_DESC_MAX_LENGTH = 200;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncates on a word boundary where reasonable, appends an ellipsis. */
function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > maxLength * 0.4 ? truncated.slice(0, lastSpace) : truncated;
  return `${base.trimEnd()}…`;
}

/**
 * `Activity.shortDesc` is required. Falls back, in order: plain-text
 * `excerpt` -> plain-text `content`. `null` only if both are empty —
 * `NormalizedEventCandidate` has no separate `shortDescription` field the
 * way Place does, so there's no third source to try.
 */
function resolveEventShortDesc(candidate: NormalizedEventCandidate): string | null {
  const fromExcerpt = stripHtml(candidate.excerpt ?? "");
  if (fromExcerpt) {
    return truncateWithEllipsis(fromExcerpt, SHORT_DESC_MAX_LENGTH);
  }

  const fromContent = stripHtml(candidate.content ?? "");
  if (fromContent) {
    return truncateWithEllipsis(fromContent, SHORT_DESC_MAX_LENGTH);
  }

  return null;
}

export interface BuildEventCreateDraftInput {
  candidate: NormalizedEventCandidate;
  context: EventCommitContext;
}

/** First value that is non-null/non-undefined and non-blank after trimming, trimmed; `null` if every candidate is missing or blank. */
function firstNonBlank(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * `context.placeId` unset (no match, or a low-confidence match the resolver
 * deliberately left null) must never block the Event, and must never lose
 * the raw venue evidence either — a `MANUAL` `EventVenue` preserves it for
 * editorial review. `null` only when there's truly nothing to preserve: no
 * matched Place *and* no venue/address hint at all.
 */
function buildVenueDraft(candidate: NormalizedEventCandidate, context: EventCommitContext): EventVenueDraft | null {
  const title = candidate.venueNameRaw;
  // `??` alone would let a blank/whitespace-only `addressEventPlaceRaw`
  // mask a real `locationRaw` — firstNonBlank() falls through past blanks.
  const addressLine = firstNonBlank(candidate.addressEventPlaceRaw, candidate.locationRaw);
  const placeId = context.placeId ?? null;

  if (!placeId && !title && !addressLine) {
    return null;
  }

  return {
    kind: placeId ? "PLACE" : "MANUAL",
    placeId,
    title,
    addressLine,
    cityId: context.cityId ?? null,
    note: !placeId && candidate.cityRaw ? `Source city hint: ${candidate.cityRaw}` : null,
    source: "wordpress-db",
  };
}

/**
 * Pure function: `NormalizedEventCandidate` + manual `EventCommitContext`
 * -> `EventCreateDraft`, or a list of block reasons. Never reads/writes a
 * database, never creates `Activity`/`ActivitySession`/`EventVenue`/
 * `Organizer`, never touches media. Every field on the resulting draft was
 * checked against the real `Activity` model in `prisma/schema.prisma`
 * before being included — see `types.ts` for what was checked and
 * rejected (`ticketUrlRaw` has no matching field at all).
 *
 * `category`/`occasion`/`organizer`/`place` are never derived from
 * `candidate.sourceTerms` — they only ever come from `context`, exactly
 * like `PlaceCommitContext.category` in PR8.5. `Activity.eventCategoryId`
 * is nullable, so an absent `context.eventCategoryId` never blocks the
 * draft — category assignment is left for a human reviewer.
 *
 * `description` keeps `candidate.content` as raw HTML, unstripped: the
 * real event-creation flow (`computeEventShortDesc({ fullDescriptionHtml:
 * description })` in `src/app/api/business/events/route.ts`) treats
 * `Activity.description` as HTML already, so stripping it here would lose
 * information the real app expects to keep.
 *
 * Schedule is the one thing this builder refuses to guess: if
 * `candidate.scheduleDraft` is `null` (ambiguous or missing `event_date`
 * values, per `normalizeEvent()`), the whole draft is blocked with
 * `MISSING_SCHEDULE` rather than inventing a `scheduleMode`.
 */
export function buildEventCreateDraft(input: BuildEventCreateDraftInput): EventCreateDraftResult {
  const { candidate, context } = input;
  const reasons: EventCommitBlockReason[] = [];

  if (!context.ownerUserId?.trim()) {
    reasons.push({ code: "MISSING_OWNER", message: "EventCommitContext.ownerUserId is required." });
  }

  if (!candidate.title?.trim()) {
    reasons.push({ code: "MISSING_TITLE", message: "NormalizedEventCandidate.title is empty." });
  }

  const shortDesc = resolveEventShortDesc(candidate);
  if (!shortDesc) {
    reasons.push({
      code: "MISSING_SHORT_DESC",
      message: "Could not derive a non-empty shortDesc from excerpt or content.",
    });
  }

  if (!candidate.scheduleDraft) {
    reasons.push({
      code: "MISSING_SCHEDULE",
      message: "candidate.scheduleDraft is null — schedule is ambiguous or missing; refusing to guess a scheduleMode.",
      details: { eventDatesRaw: candidate.eventDatesRaw },
    });
  }

  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const draft: EventCreateDraft = {
    title: candidate.title,
    shortDesc: shortDesc as string,
    description: candidate.content || null,
    type: "EVENT",
    status: "PENDING",
    ownerUserId: context.ownerUserId,
    cityId: context.cityId ?? null,
    placeId: context.placeId ?? null,
    organizerId: context.organizerId ?? null,
    eventCategoryId: context.eventCategoryId ?? null,
    scheduleMode: candidate.scheduleDraft!.mode,
    scheduleJson: candidate.scheduleDraft!,
    priceText: candidate.priceRaw,
    venue: buildVenueDraft(candidate, context),
  };

  return { ok: true, draft };
}

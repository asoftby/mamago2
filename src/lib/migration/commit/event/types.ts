import type { NormalizedEventCandidate, NormalizedEventScheduleDraft } from "../../adapters/wordpress-db/normalizeEvent";

export type { NormalizedEventCandidate };

export interface EventCommitContext {
  ownerUserId: string;
  cityId?: string | null;
  /**
   * A manual/editor choice, made available later (review UI or a follow-up
   * PR) — never derived from `sourceTerms`. `Activity.eventCategoryId` is
   * nullable in schema, so an absent value never blocks the draft.
   */
  eventCategoryId?: string | null;
  placeId?: string | null;
  organizerId?: string | null;
}

/**
 * A fallback/matched venue for `EventVenue` — always written separately from
 * the `Activity` row itself (see `EventCommitWriter`). `null`/absent only
 * when there is no venue evidence at all (no `venueNameRaw`/address hint and
 * no matched `placeId`); a real `Place` match is never required to produce
 * one — Section 5's "unresolved Place must never block the Event" policy.
 */
export interface EventVenueDraft {
  kind: "PLACE" | "MANUAL";
  /** Set only when `kind === "PLACE"`. */
  placeId: string | null;
  title: string | null;
  addressLine: string | null;
  cityId: string | null;
  /**
   * Only ever populated for `kind === "MANUAL"`, from parsed source
   * coordinates (`candidate.location`). `kind === "PLACE"` always gets
   * `null` here — the matched `Place` row is the coordinate source of
   * truth, this field never duplicates or second-guesses it.
   */
  lat: number | null;
  lng: number | null;
  note: string | null;
  source: string;
}

/**
 * Only fields confirmed to exist on the real `Activity` model
 * (`prisma/schema.prisma`) are present here. Notably absent, checked and
 * rejected during PR17: there is no `website`/`ticketUrl`-shaped field on
 * `Activity` at all (only `coverImageUrl` and `seoCanonicalUrl`, neither of
 * which fits), so `candidate.ticketUrlRaw` has nowhere safe to go and is
 * never copied anywhere.
 */
export interface EventCreateDraft {
  title: string;
  shortDesc: string;
  description: string | null;
  type: "EVENT";
  status: "PENDING";
  ownerUserId: string;
  cityId: string | null;
  placeId: string | null;
  organizerId: string | null;
  eventCategoryId: string | null;
  /** A literal subset of Prisma's `ScheduleMode` — the only two modes `normalizeEvent()` ever produces. */
  scheduleMode: NormalizedEventScheduleDraft["mode"];
  /** Import source has no explicit SLOT/WINDOW semantics; never infer it. */
  schedulingKind: null;
  scheduleJson: NormalizedEventScheduleDraft;
  /** From `candidate.priceRaw`, verbatim — no parsing into `priceFrom`/`priceTo`, no `priceDetails` fabrication. */
  priceText: string | null;
  /** Never embedded in the `Activity` row — written via a separate `EventVenue` upsert. */
  venue: EventVenueDraft | null;
}

export type EventCommitBlockReasonCode =
  | "MISSING_OWNER"
  | "MISSING_TITLE"
  | "MISSING_SHORT_DESC"
  | "MISSING_SCHEDULE";

export interface EventCommitBlockReason {
  code: EventCommitBlockReasonCode;
  message: string;
  details?: Record<string, unknown>;
}

export type EventCreateDraftResult =
  | { ok: true; draft: EventCreateDraft }
  | { ok: false; reasons: readonly EventCommitBlockReason[] };

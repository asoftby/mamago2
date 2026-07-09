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
  scheduleJson: NormalizedEventScheduleDraft;
  /** From `candidate.priceRaw`, verbatim — no parsing into `priceFrom`/`priceTo`, no `priceDetails` fabrication. */
  priceText: string | null;
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

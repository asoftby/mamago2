export const PHOENIX_V1_PAST_EVENTS_EXCLUSION_POLICY = {
  policyKey: "PHOENIX_V1_PAST_EVENTS_EXCLUDED",
  targetType: "ACTIVITY",
  reasonCode: "PAST_EVENT_EXCLUDED",
  message: "Phoenix v1 excludes past WordPress events from migration.",
} as const;

export function shouldExcludePastEvent(input: {
  startsAt: Date | string | null | undefined;
  now?: Date;
}): boolean {
  if (!input.startsAt) return false;

  const startsAt =
    input.startsAt instanceof Date ? input.startsAt : new Date(input.startsAt);

  if (Number.isNaN(startsAt.getTime())) return false;

  return startsAt.getTime() < (input.now ?? new Date()).getTime();
}

/**
 * 28 legacy WordPress Offer post IDs, manually reviewed by the owner after
 * a prior Phoenix rerun imported them as unassigned (no-Place) DRAFT Offers.
 * The owner judged them obsolete/garbage and deleted them from PROD. They
 * must never be recreated by a future rerun — exact legacy post ID match
 * only, never title/slug/fuzzy matching.
 */
export const OWNER_EXCLUDED_LEGACY_OFFER_IDS: readonly number[] = [
  42237, 42299, 43089, 43097, 43300, 43302, 43305, 43318, 43323, 43325,
  43597, 43604, 43607, 43609, 43671, 43673, 43759, 43807, 43809, 43811,
  43813, 43815, 43817, 44457, 44458, 44459, 44460, 6147,
] as const;

export const OWNER_EXCLUDED_LEGACY_OFFERS_POLICY = {
  policyKey: "OWNER_EXCLUDED_LEGACY_OFFERS_2026_08_14",
  targetType: "OFFER",
  reasonCode: "OWNER_EXCLUDED_LEGACY_OFFER",
  message:
    "Owner-approved exclusion: legacy WordPress Offer manually reviewed and removed from PROD as obsolete/garbage; must not be recreated.",
} as const;

const OWNER_EXCLUDED_LEGACY_OFFER_ID_SET = new Set(OWNER_EXCLUDED_LEGACY_OFFER_IDS);

/** Offer source-record-key shape only: `wordpress-db:(hb-programs|services):<legacy post ID>`. */
const OFFER_SOURCE_RECORD_KEY_PATTERN = /^wordpress-db:(?:hb-programs|services):(\d+)$/;

/**
 * Exact legacy post ID match against `OWNER_EXCLUDED_LEGACY_OFFER_IDS` —
 * never title/slug/fuzzy. Non-Offer keys (or malformed ones) never match.
 */
export function isOwnerExcludedLegacyOfferSourceRecordKey(sourceRecordKey: string): boolean {
  const match = OFFER_SOURCE_RECORD_KEY_PATTERN.exec(sourceRecordKey);
  if (!match) return false;
  return OWNER_EXCLUDED_LEGACY_OFFER_ID_SET.has(Number(match[1]));
}

/**
 * Legacy WordPress Event post ID 64586, owner-excluded from Phoenix
 * migration (2026-08-15) — see
 * `docs/migration/production-entity-manifests-2026-07-29.md` (2026-08-15
 * update). Has no `event_date` postmeta at all (`MISSING_SCHEDULE`), unlike
 * 64588 which imports fine under the existing tolerant-schedule fallback —
 * that ID is deliberately NOT in this list and must keep importing
 * normally. Exact legacy post ID match only, never title/slug/fuzzy.
 */
export const OWNER_EXCLUDED_LEGACY_EVENT_IDS: readonly number[] = [64586] as const;

export const OWNER_EXCLUDED_LEGACY_EVENTS_POLICY = {
  policyKey: "OWNER_EXCLUDED_LEGACY_EVENTS_2026_08_15",
  targetType: "ACTIVITY",
  reasonCode: "OWNER_EXCLUDED_LEGACY_EVENT",
  message:
    "Owner-approved exclusion: legacy WordPress Event has no event_date postmeta (MISSING_SCHEDULE) and must not be imported.",
} as const;

const OWNER_EXCLUDED_LEGACY_EVENT_ID_SET = new Set(OWNER_EXCLUDED_LEGACY_EVENT_IDS);

/** Event source-record-key shape only: `wordpress-db:events:<legacy post ID>`. */
const EVENT_SOURCE_RECORD_KEY_PATTERN = /^wordpress-db:events:(\d+)$/;

/**
 * Exact legacy post ID match against `OWNER_EXCLUDED_LEGACY_EVENT_IDS` —
 * never title/slug/fuzzy. Non-Event keys (or malformed ones) never match.
 */
export function isOwnerExcludedLegacyEventSourceRecordKey(sourceRecordKey: string): boolean {
  const match = EVENT_SOURCE_RECORD_KEY_PATTERN.exec(sourceRecordKey);
  if (!match) return false;
  return OWNER_EXCLUDED_LEGACY_EVENT_ID_SET.has(Number(match[1]));
}

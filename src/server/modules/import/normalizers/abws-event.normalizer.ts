/**
 * ABWS Event Normalizer — abws-performances-event rawPayload → NormalizedEventImport
 *
 * Separate from event.normalizer.ts's normalizeEventPayload() on purpose:
 * that function only reads flat, single-venue/single-date fields (by
 * guessing among several possible key names) and has no awareness of a
 * `sessions[]` array. Confirmed empirically (live pipeline run, PR #273/
 * #275): every ABWS record normalized through it came back with
 * venueName/startAt/priceText all undefined and matchStatus=NO_MATCH,
 * because the real data lives nested in `rawPayload.sessions[]`, which it
 * never looks at.
 *
 * This function reads the ABWS-specific, already-typed rawPayload shape
 * directly (no key-name guessing) and populates the additive
 * `occurrences[]` field (see types/index.ts) alongside a best-effort
 * "first occurrence" in the existing flat fields for any consumer not yet
 * updated to read `occurrences[]`.
 *
 * normalizeEventPayload itself is not imported, called, or modified here.
 */

import type { EventNormalizerInput, EventNormalizerOutput } from "./event.normalizer";
import type { NormalizedEventImport } from "../types";
import type { AbwsPerformanceRawPayload, AbwsPerformanceType } from "../parsers/abws-performances-event.parser";

/** Dispatch key — kept local so normalizing this source doesn't require importing from parsers/. */
export const ABWS_PARSER_KEY = "abws-performances-event";

/** "Name (id)" when the source gave a name, else just the bare id. */
function formatAbwsTypeLabel(type: AbwsPerformanceType): string {
  return type.name ? `${type.name} (${type.id})` : String(type.id);
}

const SHORT_DESC_MAX = 200;

/** 1.00 BYN in kopecks — the price-floor gate threshold (§ decisions doc). */
const PRICE_FLOOR_CENTS = 100;
const MINSK_CITY_SLUG = "minsk";

/**
 * Review-queue gate marks for one ABWS record — informational only, never
 * blocking (publication is already manual). All three keys are always
 * present with an explicit boolean: a record with none of the gates
 * triggered still gets `{ multiVenue: false, belowPriceFloor: false,
 * nonMinskCity: false }`, never a partial object, so a later
 * `GROUP BY qualityFlags->>'x'` has a correct denominator.
 */
export interface AbwsQualityFlags {
  multiVenue: boolean;
  belowPriceFloor: boolean;
  nonMinskCity: boolean;
}

export function computeAbwsQualityFlags(payload: AbwsPerformanceRawPayload): AbwsQualityFlags {
  const multiVenue = !payload.isSingleVenue;

  // Per-session price when there are sessions to read (the normal case);
  // fall back to the performance-level price only for the rare record with
  // no sessions at all. Never mix the two into one comparison — sessions
  // carry kopecks, the performance-level fallback carries rubles (§2.4).
  const belowPriceFloor =
    payload.sessions.length > 0
      ? payload.sessions.some(
          (session) => session.priceMinCents != null && session.priceMinCents < PRICE_FLOOR_CENTS,
        )
      : payload.perfPriceMinRub != null && payload.perfPriceMinRub < PRICE_FLOOR_CENTS / 100;

  // Single-venue-only scope (§0): one city is representative for the whole
  // record. Unknown city is treated as "not confirmed Minsk" — flagged
  // rather than silently assumed to be in scope.
  const cityName = payload.sessions[0]?.venue?.city?.slug ?? null;
  const nonMinskCity = cityName !== MINSK_CITY_SLUG;

  return { multiVenue, belowPriceFloor, nonMinskCity };
}

function deriveShortDesc(description: string): string {
  if (description.length <= SHORT_DESC_MAX) return description;
  const truncated = description.slice(0, SHORT_DESC_MAX);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated).trimEnd() + "…";
}

function formatRub(rub: number | null): string | undefined {
  return rub != null ? `${rub.toFixed(2)} BYN` : undefined;
}

/** kopecks -> "X.XX BYN". Kept separate from formatRub: never feed the same
 * number through both, per §2.4 — the two units are not interchangeable. */
function formatCentsAsRub(cents: number | null): string | undefined {
  return cents != null ? `${(cents / 100).toFixed(2)} BYN` : undefined;
}

export function normalizeAbwsEventPayload(input: EventNormalizerInput): EventNormalizerOutput {
  const { sourceSlug, sourceUrl, externalId, sourceUpdatedAt } = input;
  const payload = input.rawPayload as unknown as AbwsPerformanceRawPayload;
  const warnings: string[] = [];

  if (!payload.title) warnings.push("title missing");

  const description = payload.description ?? undefined;
  const shortDescCandidate = description ? deriveShortDesc(description) : undefined;
  if (!shortDescCandidate) warnings.push("shortDescCandidate missing");

  // Preserve the complete source snapshot, including withdrawn sessions. The
  // publish layer needs lifecycle state to withdraw/re-activate ActivitySession
  // rows without deleting their source identity.
  const occurrences = payload.sessions.map((session) => ({
    externalId: session.externalId,
    startAt: session.startsAt,
    venueName: session.venue?.name ?? undefined,
    addressText: session.venue?.address ?? undefined,
    cityName: session.venue?.city?.slug ?? undefined,
    priceText: formatCentsAsRub(session.priceMinCents),
    priceMinCents: session.priceMinCents,
    priceMaxCents: session.priceMaxCents,
    buyUrl: session.buyUrl ?? undefined,
    isSaleOpen: session.isSaleOpen ?? undefined,
    withdrawnAt: session.withdrawnAt ?? null,
  }));

  // Flat fields are only a compatibility representation. They must point to
  // the earliest ACTIVE session, not simply sessions[0]: the first session can
  // already be in the past or withdrawn while later sessions remain valid.
  const activeSessions = payload.sessions
    .filter((session) => !session.withdrawnAt)
    .slice()
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const first = activeSessions[0];
  const venueName = first?.venue?.name ?? undefined;
  const addressText = first?.venue?.address ?? undefined;
  const cityName = first?.venue?.city?.slug ?? undefined;
  const startAt = first?.startsAt ?? (payload.sessions.length === 0 ? payload.showFrom ?? undefined : undefined);

  if (!venueName && !addressText) warnings.push("venue and address both missing");
  if (!cityName) warnings.push("city missing");
  if (!startAt) warnings.push("startAt missing");

  // Performance-level fallback price, rubles (§2.4) — only used when there
  // are no active sessions to read a per-session price from; never mixed with
  // the per-session kopeck values above via a shared conversion function.
  const priceText = first ? undefined : formatRub(payload.perfPriceMinRub);

  // Human-readable "Name (id)" labels for the reviewer, not bare numeric
  // ids — the reviewer has no reason to memorize the ABWS type-id table.
  // recognizedTypes/unrecognizedTypes carry the source's own type.name;
  // payload.categoryTypeIds (bare numbers, no name) is kept only as a
  // fallback for records normalized by parser code that predates these two
  // fields (stored rawPayload from before this change).
  const categoryCandidates =
    payload.recognizedTypes && payload.recognizedTypes.length > 0
      ? payload.recognizedTypes.map(formatAbwsTypeLabel)
      : payload.categoryTypeIds.map((id) => String(id));
  if (categoryCandidates.length === 0) warnings.push("categoryCandidates empty — will attempt AI detection");

  // Everything outside the recognized-category whitelist (venue names
  // mixed in with real signals like "Театр кукол"/"Детям", per
  // CATEGORY_TYPE_IDS's own comment) — never auto-mapped, shown to the
  // reviewer as-is so they can act on a signal the whitelist doesn't
  // recognize yet (see docs/engineering/backlog.md's Театр кукол note).
  const otherCategoryCandidates =
    payload.unrecognizedTypes && payload.unrecognizedTypes.length > 0
      ? payload.unrecognizedTypes.map(formatAbwsTypeLabel)
      : undefined;

  const normalized: NormalizedEventImport = {
    entityType: "EVENT",
    sourceSlug,
    sourceUrl,
    externalId: externalId ?? null,
    sourceUpdatedAt,
    title: payload.title,
    shortDescCandidate,
    description,
    // ABWS content is always a physical, multi-session-capable event —
    // these two are straightforward defaults, not a guess among unrelated
    // possibilities the way the generic normalizer's extraction is.
    typeCandidate: "EVENT",
    formatCandidate: "OFFLINE",
    scheduleModeCandidate: activeSessions.length > 1 ? "MULTI_DATE" : "ONE_TIME",
    venueName,
    addressText,
    cityName,
    startAt,
    ageText: payload.ageMin != null ? `от ${payload.ageMin}` : undefined,
    priceText,
    categoryCandidates,
    ...(otherCategoryCandidates ? { otherCategoryCandidates } : {}),
    imageUrls: payload.images,
    // ABWS snapshots are authoritative even when the array is empty. Keeping
    // [] lets the publish layer reconcile previously stored sessions away.
    occurrences,
    ...(payload.perfBuyUrl ? { performanceBuyUrl: payload.perfBuyUrl } : {}),
  };

  return { normalized, warnings, aiDetectedCategory: null };
}

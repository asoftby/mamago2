import type { OpeningHoursData } from "@/components/openingHours/openingHours.types";

import type { NormalizedPlaceCandidate } from "../../adapters/wordpress-db/normalizePlace";

export type { NormalizedPlaceCandidate };

/**
 * Everything a caller must supply that this pure mapper cannot decide for
 * itself. `createdByUserId` is required and never defaulted — this module
 * does not create or choose a "system user" (see PR8.5 scope decision).
 * `cityId` is required to already be resolved externally (e.g. via the
 * same city-name lookup the old import module uses) — this mapper never
 * guesses a city from `cityRaw`.
 *
 * `category` is a manual editor choice, not derived from WordPress data.
 * Missing category is allowed for Phoenix imports and flagged for later
 * editorial review; `sourceTerms` remains only a human hint.
 */
export interface PlaceCommitContext {
  createdByUserId: string;
  cityId?: string | null;
  category?: string | null;
}

/**
 * Only fields safe to hand to `prisma.place.create({ data })` as-is — no
 * media/logo/gallery, no `ownerBusinessId`, `slug` always `null` (assigned
 * later by the existing `placeSlugService`, same as every other Place
 * create path in this codebase).
 */
export interface PlaceCreateDraft {
  title: string;
  shortDesc: string;
  description: string | null;
  category?: string;
  status: "PENDING";
  locationSource: "MANUAL";
  createdByUserId: string;
  cityId: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  /** `Place.website` exists but `NormalizedPlaceCandidate` has no source field for it yet (its `email` is a different WP postmeta key, not a website URL) — always `null` in PR8.5. */
  website: string | null;
  slug: null;
  /**
   * Carried through verbatim from `candidate.openingHours` — already the
   * canonical shape `mapToCreatePayload`/`mapToUpdatePayload`
   * (`src/lib/openingHours/openingHoursMapper.ts`) expect, so the writer
   * never re-derives it. `undefined` means "no usable schedule, don't
   * touch/create an OpeningHours row" — never a fabricated default.
   */
  openingHours?: OpeningHoursData;
}

export type PlaceCommitBlockReasonCode =
  | "MISSING_CREATED_BY"
  | "MISSING_TITLE"
  | "MISSING_SHORT_DESC"
  | "MISSING_CATEGORY";

export interface PlaceCommitBlockReason {
  code: PlaceCommitBlockReasonCode;
  message: string;
  details?: Record<string, unknown>;
}

export type PlaceCommitWarningCode = "CATEGORY_MISSING_REQUIRES_REVIEW";

export interface PlaceCommitWarning {
  code: PlaceCommitWarningCode;
  message: string;
  details?: Record<string, unknown>;
}

export type PlaceCreateDraftResult =
  | { ok: true; draft: PlaceCreateDraft; warnings: readonly PlaceCommitWarning[] }
  | { ok: false; reasons: readonly PlaceCommitBlockReason[] };

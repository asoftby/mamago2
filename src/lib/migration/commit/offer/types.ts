import type { MediaPolicyName } from "../../runtime/MigrationProfile";

/**
 * placeId/legacyPlaceId/ownerUserId/cityId are `null` together only for a
 * deliberate placeless DRAFT import (Offer source has zero Place relation
 * rows — see collapseOfferPlaceRelations' "MISSING" status). Any other
 * combination (e.g. a single null field) is an incomplete context, not a
 * placeless one, and resolveCommitContextConfig rejects it.
 */
export interface OfferCommitContext { placeId: string | null; legacyPlaceId: number | null; ownerUserId: string | null; businessId?: string | null; cityId: string | null; mediaPolicy: MediaPolicyName }
export interface OfferCreateDraft {
  placeId: string | null; createRequestId: string; kind: "SERVICE"; productType: null; title: string; description: string | null; status: "DRAFT";
  priceFrom: number | null; priceText: string | null; ageMinMonths: number | null; ageMaxMonths: number | null;
  contactPhone: string | null; contactWebsite: string | null; seoTitle: string | null; seoDescription: string | null;
  seoCanonicalUrl: string | null; seoRobots: string | null; seoOgTitle: string | null; seoOgDescription: string | null;
  sourceMediaAttachmentIds: readonly number[];
  ownership: { ownerUserId: string | null; businessId: string | null; cityId: string | null };
}
export type OfferCommitBlockReasonCode = "UNSUPPORTED_SOURCE_POST_TYPE" | "NONCANONICAL_SOURCE_ALIAS" | "MISSING_TITLE" | "MISSING_PLACE_RELATION" | "AMBIGUOUS_PLACE_RELATION" | "INVALID_PLACE_RELATION" | "MISSING_LOCAL_PLACE" | "PLACE_RELATION_MISMATCH" | "MISSING_OWNER" | "MISSING_CITY";
export interface OfferCommitBlockReason { code: OfferCommitBlockReasonCode; message: string; details?: Record<string, unknown> }
export interface OfferCommitWarning { code: string; message: string; details?: Record<string, unknown> }

import type { MediaPolicyName } from "../../runtime/MigrationProfile";

export interface OfferCommitContext { placeId: string; legacyPlaceId: number; ownerUserId: string; businessId?: string | null; cityId: string; mediaPolicy: MediaPolicyName }
export interface OfferCreateDraft {
  placeId: string; createRequestId: string; kind: "SERVICE"; productType: null; title: string; description: string | null; status: "DRAFT";
  priceFrom: number | null; priceText: string | null; ageMinMonths: number | null; ageMaxMonths: number | null;
  contactPhone: string | null; contactWebsite: string | null; seoTitle: string | null; seoDescription: string | null;
  seoCanonicalUrl: string | null; seoRobots: string | null; seoOgTitle: string | null; seoOgDescription: string | null;
  sourceMediaAttachmentIds: readonly number[];
  ownership: { ownerUserId: string; businessId: string | null; cityId: string };
}
export type OfferCommitBlockReasonCode = "UNSUPPORTED_SOURCE_POST_TYPE" | "NONCANONICAL_SOURCE_ALIAS" | "MISSING_TITLE" | "MISSING_PLACE_RELATION" | "AMBIGUOUS_PLACE_RELATION" | "INVALID_PLACE_RELATION" | "MISSING_LOCAL_PLACE" | "PLACE_RELATION_MISMATCH" | "MISSING_OWNER" | "MISSING_CITY";
export interface OfferCommitBlockReason { code: OfferCommitBlockReasonCode; message: string; details?: Record<string, unknown> }
export interface OfferCommitWarning { code: string; message: string; details?: Record<string, unknown> }

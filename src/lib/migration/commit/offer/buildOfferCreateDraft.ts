import { createHash } from "node:crypto";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import type { OfferCommitContext, OfferCommitBlockReason, OfferCommitWarning, OfferCreateDraft } from "./types";
import { normalizeSingleLineText } from "../../text/normalizeSingleLineText";

export type OfferCreateDraftResult = { ok: true; draft: OfferCreateDraft; warnings: readonly OfferCommitWarning[]; canonicalHash: string } | { ok: false; reasons: readonly OfferCommitBlockReason[] };
function stableJson(value: unknown): string { return JSON.stringify(value, (_key, nested) => nested && typeof nested === "object" && !Array.isArray(nested) ? Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b))) : nested) }
function firstMeta(candidate: NormalizedOfferCandidate, ...keys: string[]): string | null { for (const key of keys) { const value = candidate.rawMeta[key]?.[0]?.trim(); if (value) return value } return null }

export function buildOfferCanonicalCommitHash(input: { candidate: NormalizedOfferCandidate; context: OfferCommitContext; draft: OfferCreateDraft }): string {
  const material = {
    sourceRecordKey: input.candidate.sourceRecordKey,
    content: { title: input.draft.title, description: input.draft.description, slug: input.candidate.slug },
    mapping: { placeId: input.draft.placeId, legacyPlaceId: input.context.legacyPlaceId, ownerUserId: input.context.ownerUserId, businessId: input.context.businessId ?? null, cityId: input.context.cityId, kind: input.draft.kind, productType: input.draft.productType, status: input.draft.status },
    pricing: { priceFrom: input.draft.priceFrom, priceText: input.draft.priceText }, contacts: { phone: input.draft.contactPhone, website: input.draft.contactWebsite },
    age: { minMonths: input.draft.ageMinMonths, maxMonths: input.draft.ageMaxMonths },
    seo: { title: input.draft.seoTitle, description: input.draft.seoDescription, canonicalUrl: input.draft.seoCanonicalUrl, robots: input.draft.seoRobots, ogTitle: input.draft.seoOgTitle, ogDescription: input.draft.seoOgDescription },
    media: [...input.draft.sourceMediaAttachmentIds].sort((a, b) => a - b), mediaPolicy: input.context.mediaPolicy,
  };
  return `offer-commit-v1:${createHash("sha256").update(stableJson(material)).digest("hex")}`;
}

export function buildOfferCreateDraft(input: { candidate: NormalizedOfferCandidate; context: OfferCommitContext }): OfferCreateDraftResult {
  const { candidate, context } = input; const reasons: OfferCommitBlockReason[] = [];
  const title = normalizeSingleLineText(candidate.title ?? "");
  if (!(["hb-programs", "services"] as string[]).includes(candidate.sourcePostType)) reasons.push({ code: candidate.sourcePostType === ("offers" as string) ? "NONCANONICAL_SOURCE_ALIAS" : "UNSUPPORTED_SOURCE_POST_TYPE", message: `Unsupported Offer source post type: ${candidate.sourcePostType}.` });
  if (!title) reasons.push({ code: "MISSING_TITLE", message: "Offer title is required." });
  const uniqueLegacyPlaceIds = [...new Set(candidate.placeRelation.placeSourcePostIds)].sort((a, b) => a - b);
  if (!uniqueLegacyPlaceIds.length) reasons.push({ code: "MISSING_PLACE_RELATION", message: "Offer requires one Place relation." });
  if (uniqueLegacyPlaceIds.length > 1) reasons.push({ code: "AMBIGUOUS_PLACE_RELATION", message: "Offer relations resolve to multiple legacy Places.", details: { legacyPlaceIds: uniqueLegacyPlaceIds } });
  if (!context.placeId?.trim()) reasons.push({ code: "MISSING_LOCAL_PLACE", message: "An exact local Place match is required." });
  if (uniqueLegacyPlaceIds.length === 1 && uniqueLegacyPlaceIds[0] !== context.legacyPlaceId) reasons.push({ code: "PLACE_RELATION_MISMATCH", message: "Resolved context does not match the source Place relation." });
  if (!context.ownerUserId?.trim()) reasons.push({ code: "MISSING_OWNER", message: "Resolved Place ownership is required." });
  if (!context.cityId?.trim()) reasons.push({ code: "MISSING_CITY", message: "Offer city must be derived from the resolved Place." });
  if (reasons.length) return { ok: false, reasons };
  const ageRanges = candidate.ageTerms.map(term => term.parsedMonths).filter((value): value is NonNullable<typeof value> => value !== null);
  const finiteMax = ageRanges.map(value => value.maxMonths).filter((value): value is number => value !== null);
  const mediaIds = [...(candidate.media.coverAttachmentId === null ? [] : [candidate.media.coverAttachmentId]), ...candidate.media.galleryAttachmentIds];
  const draft: OfferCreateDraft = {
    placeId: context.placeId, createRequestId: candidate.sourceRecordKey, kind: "SERVICE", productType: null, title, description: candidate.content?.trim() || candidate.shortDescription?.trim() || candidate.excerpt?.trim() || null, status: "DRAFT",
    priceFrom: candidate.averageCheck.parsed, priceText: candidate.priceText, ageMinMonths: ageRanges.length ? Math.min(...ageRanges.map(v => v.minMonths)) : null, ageMaxMonths: ageRanges.length && finiteMax.length === ageRanges.length ? Math.max(...finiteMax) : null,
    contactPhone: firstMeta(candidate, "phone", "phone-service", "program-phone"), contactWebsite: firstMeta(candidate, "website", "website-service", "program-website", "external-url"),
    seoTitle: candidate.seo.title, seoDescription: candidate.seo.description, seoCanonicalUrl: candidate.seo.canonicalUrl, seoRobots: candidate.seo.robots, seoOgTitle: candidate.seo.ogTitle, seoOgDescription: candidate.seo.ogDescription,
    sourceMediaAttachmentIds: [...new Set(mediaIds)].sort((a, b) => a - b), ownership: { ownerUserId: context.ownerUserId, businessId: context.businessId ?? null, cityId: context.cityId },
  };
  const warnings: OfferCommitWarning[] = [];
  if (candidate.sourceTerms.length) warnings.push({ code: "OFFER_SOURCE_TAXONOMY_PRESERVED", message: "Legacy taxonomy remains normalized evidence; no target category is guessed.", details: { count: candidate.sourceTerms.length } });
  if (candidate.placeRelation.relations.length > 1) warnings.push({ code: "OFFER_PLACE_RELATIONS_DEDUPLICATED", message: "Multiple relation rows converged on one legacy Place.", details: { rowCount: candidate.placeRelation.relations.length, legacyPlaceId: context.legacyPlaceId } });
  return { ok: true, draft, warnings, canonicalHash: buildOfferCanonicalCommitHash({ candidate, context, draft }) };
}

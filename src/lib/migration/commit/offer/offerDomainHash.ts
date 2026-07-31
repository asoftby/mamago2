import { createHash } from "node:crypto";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import { normalizeSingleLineText } from "../../text/normalizeSingleLineText";
import type { MediaPolicyName } from "../../runtime/MigrationProfile";

export const OFFER_DOMAIN_HASH_VERSION = "offer-domain-v2";
export const OFFER_EXECUTION_POLICY_HASH_VERSION = "offer-execution-policy-v1";

export interface OfferLogicalDependencies {
  placeSourceRecordKey: string;
  ownerIdentity: { kind: "technicalMigrationCreator" | "userSourceRecordKey"; value: string };
  businessSourceKey: string | null;
}

export interface OfferDomainPayloadV2 {
  sourceRecordKey: string;
  content: { title: string; slug: string; description: string | null };
  classification: { kind: "SERVICE"; productType: null };
  pricing: { priceFrom: number | null; priceText: string | null };
  age: { minMonths: number | null; maxMonths: number | null };
  contacts: { phone: string | null; website: string | null };
  schedule: { bookingSettingsHash: string | null; schemaVariant: string | null };
  lifecycle: { status: "DRAFT"; visibility: "NOT_PUBLIC" };
  dependencies: OfferLogicalDependencies;
  mediaSourceIdentities: string[];
  seo: { title: string | null; description: string | null; canonicalUrl: string | null; robots: string | null; ogTitle: string | null; ogDescription: string | null };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function hash(version: string, payload: unknown): string {
  return `${version}:${createHash("sha256").update(stableJson(payload)).digest("hex")}`;
}

function firstMeta(candidate: NormalizedOfferCandidate, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = candidate.rawMeta[key]?.[0]?.trim();
    if (value) return value;
  }
  return null;
}

export function buildOfferDomainPayloadV2(candidate: NormalizedOfferCandidate, dependencies: OfferLogicalDependencies): OfferDomainPayloadV2 {
  const ageRanges = candidate.ageTerms.map((term) => term.parsedMonths).filter((value): value is NonNullable<typeof value> => value !== null);
  const finiteMax = ageRanges.map((value) => value.maxMonths).filter((value): value is number => value !== null);
  const mediaIds = [...(candidate.media.coverAttachmentId === null ? [] : [candidate.media.coverAttachmentId]), ...candidate.media.galleryAttachmentIds];
  return {
    sourceRecordKey: candidate.sourceRecordKey,
    content: { title: normalizeSingleLineText(candidate.title), slug: candidate.slug, description: candidate.content?.trim() || candidate.shortDescription?.trim() || candidate.excerpt?.trim() || null },
    classification: { kind: "SERVICE", productType: null },
    pricing: { priceFrom: candidate.averageCheck.parsed, priceText: candidate.priceText },
    age: { minMonths: ageRanges.length ? Math.min(...ageRanges.map((value) => value.minMonths)) : null, maxMonths: ageRanges.length && finiteMax.length === ageRanges.length ? Math.max(...finiteMax) : null },
    contacts: { phone: firstMeta(candidate, "phone", "phone-service", "program-phone"), website: firstMeta(candidate, "website", "website-service", "program-website", "external-url") },
    schedule: { bookingSettingsHash: candidate.booking.raw === null ? null : createHash("sha256").update(candidate.booking.raw).digest("hex"), schemaVariant: candidate.booking.schemaVariant },
    lifecycle: { status: "DRAFT", visibility: "NOT_PUBLIC" },
    dependencies,
    mediaSourceIdentities: [...new Set(mediaIds)].sort((a, b) => a - b).map((id) => `wordpress-db:attachment:${id}`),
    seo: { title: candidate.seo.title, description: candidate.seo.description, canonicalUrl: candidate.seo.canonicalUrl, robots: candidate.seo.robots, ogTitle: candidate.seo.ogTitle, ogDescription: candidate.seo.ogDescription },
  };
}

export function buildOfferDomainHashV2(candidate: NormalizedOfferCandidate, dependencies: OfferLogicalDependencies): string {
  return hash(OFFER_DOMAIN_HASH_VERSION, buildOfferDomainPayloadV2(candidate, dependencies));
}

export function buildOfferExecutionPolicyHashV1(input: { environment: "LOCAL" | "DEV" | "PROD"; mediaPolicy: MediaPolicyName; binaryUploadAllowed: boolean; metadataOnly: boolean }): string {
  return hash(OFFER_EXECUTION_POLICY_HASH_VERSION, input);
}

export type OfferHashTransitionDisposition = "LEGACY_MATCH" | "LINEAGE_HASH_TRANSITION" | "SAFE_DOMAIN_UPDATE" | "CONFLICT" | "BLOCKED_INSUFFICIENT_EVIDENCE";

export function planOfferHashTransition(input: { lineageCount: number; targetCount: number; predecessorMatches: boolean; targetDomainMatches: boolean; supportedUpdate: boolean }): OfferHashTransitionDisposition {
  if (input.lineageCount !== 1 || input.targetCount !== 1) return "CONFLICT";
  if (!input.predecessorMatches) return "BLOCKED_INSUFFICIENT_EVIDENCE";
  if (input.targetDomainMatches) return "LINEAGE_HASH_TRANSITION";
  return input.supportedUpdate ? "SAFE_DOMAIN_UPDATE" : "CONFLICT";
}

export async function executeLineageHashTransition(input: {
  disposition: OfferHashTransitionDisposition;
  sourceRecordKey: string;
  expectedPredecessorHash: string;
  domainHashV2: string;
  updateLineageCas: (value: { sourceRecordKey: string; expectedPredecessorHash: string; domainHashV2: string }) => Promise<{ updatedCount: number }>;
}): Promise<{ outcome: "LINEAGE_HASH_TRANSITION" | "FAILED"; reasonCode?: string }> {
  if (input.disposition !== "LINEAGE_HASH_TRANSITION") return { outcome: "FAILED", reasonCode: "DISPOSITION_NOT_LINEAGE_TRANSITION" };
  const result = await input.updateLineageCas({ sourceRecordKey: input.sourceRecordKey, expectedPredecessorHash: input.expectedPredecessorHash, domainHashV2: input.domainHashV2 });
  return result.updatedCount === 1 ? { outcome: "LINEAGE_HASH_TRANSITION" } : { outcome: "FAILED", reasonCode: "PREDECESSOR_CAS_FAILED" };
}

import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { normalizeOffer, type NormalizedOfferCandidate } from "../src/lib/migration/adapters/wordpress-db/normalizeOffer";
import type { SourceRecordEnvelope } from "../src/lib/migration/types";
import type { WordPressOfferBundle } from "../src/lib/migration/adapters/wordpress-db/types";
import { collapseOfferPlaceRelations } from "../src/lib/migration/commit/offer/collapseOfferPlaceRelations";
import { buildOfferDomainHashV2, buildOfferDomainPayloadV2, planOfferHashTransition } from "../src/lib/migration/commit/offer/offerDomainHash";
import { buildOfferCreateDraft } from "../src/lib/migration/commit/offer/buildOfferCreateDraft";
import { normalizeSingleLineText } from "../src/lib/migration/text/normalizeSingleLineText";

type Capture = { manifestHash: string; records: SourceRecordEnvelope[] };
type FrozenOffer = { lineage: { sourceRecordKey: string; lastSourceHash: string } };
function arg(name: string): string { const index = process.argv.indexOf(name); const value = index === -1 ? undefined : process.argv[index + 1]; if (!value) throw new Error(`Missing ${name} <value>.`); return value; }
const capture = JSON.parse(readFileSync(arg("--capture"), "utf8")) as Capture;
const frozen = JSON.parse(readFileSync(arg("--frozen-local-manifest"), "utf8")) as FrozenOffer[];
const predecessorByKey = new Map(frozen.map((row) => [row.lineage.sourceRecordKey, row.lineage.lastSourceHash]));
const prisma = new PrismaClient();

const same = (a: unknown, b: unknown): boolean => a === b || (a == null && b == null);

async function main(): Promise<void> {
  const records = [];
  for (const envelope of capture.records) {
    const captured = envelope.rawPayload as WordPressOfferBundle;
    const bundle: WordPressOfferBundle = { ...captured, placeRelations: captured.placeRelations.map((row) => ({ ...row, post_id: Number(row.post_id), related_post_id: Number(row.related_post_id), relation_order: Number(row.relation_order) })) };
    const candidate = normalizeOffer(bundle).normalizedPayload as unknown as NormalizedOfferCandidate;
    const collapsed = collapseOfferPlaceRelations({ offerPostId: candidate.sourcePostId, relations: candidate.placeRelation.relations });
    if (collapsed.status !== "RESOLVED") { records.push({ sourceRecordKey: envelope.sourceRecordKey, changedFieldCategories: ["PLACE_DEPENDENCY"], disposition: "CONFLICT", reasonCode: `PLACE_${collapsed.status}`, requiredWriterCapability: null, domainHashV2: null }); continue; }
    const placeKey = `wordpress-db:places:${collapsed.effectiveLegacyPlaceId}`;
    const placeLineages = await prisma.migrationLineage.findMany({ where: { sourceRecordKey: placeKey, targetType: "PLACE", isActive: true } });
    const placeId = placeLineages[0]?.targetId;
    const place = placeId ? await prisma.place.findUnique({ where: { id: placeId }, select: { id: true, createdByUserId: true, ownerBusinessId: true, cityId: true } }) : null;
    const business = place?.ownerBusinessId ? await prisma.business.findUnique({ where: { id: place.ownerBusinessId }, select: { id: true } }) : null;
    const lineages = await prisma.migrationLineage.findMany({ where: { sourceRecordKey: envelope.sourceRecordKey, targetType: "OFFER", isActive: true } });
    const targetId = lineages[0]?.targetId;
    const target = targetId ? await prisma.offer.findUnique({ where: { id: targetId } }) : null;
    const dependencies = { placeSourceRecordKey: placeKey, ownerIdentity: { kind: "technicalMigrationCreator" as const, value: "technicalMigrationCreator" }, businessSourceKey: place?.ownerBusinessId ? `place-owner-business:${placeKey}` : null };
    const payload = buildOfferDomainPayloadV2(candidate, dependencies);
    const domainHashV2 = buildOfferDomainHashV2(candidate, dependencies);
    const legacyBuilt = place ? buildOfferCreateDraft({ candidate, context: { placeId: place.id, legacyPlaceId: collapsed.effectiveLegacyPlaceId, ownerUserId: place.createdByUserId, businessId: place.ownerBusinessId, cityId: place.cityId ?? "", mediaPolicy: "NONE" } }) : null;
    const categories: string[] = [];
    if (placeLineages.length !== 1 || !place || !place.cityId) categories.push("PLACE_DEPENDENCY");
    if (place?.ownerBusinessId && !business) categories.push("BUSINESS_DEPENDENCY");
    if (!target) categories.push("TARGET_MISSING");
    if (target) {
      if (target.title !== payload.content.title) categories.push(normalizeSingleLineText(target.title) === payload.content.title ? "TITLE_WHITESPACE_ONLY" : "TITLE");
      if (!same(target.slug, payload.content.slug)) categories.push("SLUG");
      if (!same(target.description, payload.content.description)) categories.push("CONTENT");
      if (target.kind !== payload.classification.kind || !same(target.productType, payload.classification.productType)) categories.push("KIND");
      if (!same(target.priceFrom, payload.pricing.priceFrom) || !same(target.priceText, payload.pricing.priceText)) categories.push("PRICING");
      if (!same(target.ageMinMonths, payload.age.minMonths) || !same(target.ageMaxMonths, payload.age.maxMonths)) categories.push("AGE");
      if (!same(target.contactPhone, payload.contacts.phone) || !same(target.contactWebsite, payload.contacts.website)) categories.push("CONTACTS");
      if (target.status !== payload.lifecycle.status) categories.push("STATUS_VISIBILITY");
      if (target.placeId !== place?.id || target.createRequestId !== envelope.sourceRecordKey) categories.push("PLACE_DEPENDENCY");
      if (!same(target.seoTitle, payload.seo.title) || !same(target.seoDescription, payload.seo.description) || !same(target.seoCanonicalUrl, payload.seo.canonicalUrl) || !same(target.seoRobots, payload.seo.robots) || !same(target.seoOgTitle, payload.seo.ogTitle) || !same(target.seoOgDescription, payload.seo.ogDescription)) categories.push("SEO");
    }
    if (payload.mediaSourceIdentities.length) categories.push("MEDIA_REFERENCES_UNRECONCILED");
    if (payload.schedule.bookingSettingsHash) categories.push("SCHEDULE_UNSUPPORTED");
    const changedFieldCategories = [...new Set(categories)].sort();
    const expectedPredecessor = predecessorByKey.get(envelope.sourceRecordKey);
    const predecessorMatches = Boolean(expectedPredecessor && lineages[0]?.lastSourceHash === expectedPredecessor);
    const supportedUpdate = changedFieldCategories.length === 1 && changedFieldCategories[0] === "TITLE_WHITESPACE_ONLY";
    const disposition = planOfferHashTransition({ lineageCount: lineages.length, targetCount: target ? 1 : 0, predecessorMatches, targetDomainMatches: changedFieldCategories.length === 0, supportedUpdate });
    const reasonCode = disposition === "LINEAGE_HASH_TRANSITION" ? "FULL_TARGET_RECONCILIATION_MATCH" : disposition === "SAFE_DOMAIN_UPDATE" ? "TITLE_WHITESPACE_ONLY" : !predecessorMatches ? "LEGACY_PREDECESSOR_MISMATCH" : changedFieldCategories.includes("PLACE_DEPENDENCY") || changedFieldCategories.includes("BUSINESS_DEPENDENCY") ? "DEPENDENCY_MISMATCH" : changedFieldCategories.length > 1 ? "UNSUPPORTED_MULTI_FIELD_DRIFT" : `UNSUPPORTED_${changedFieldCategories[0] ?? "UNKNOWN"}`;
    const freshLegacyHashMatches = Boolean(legacyBuilt?.ok && legacyBuilt.canonicalHash === lineages[0]?.lastSourceHash);
    records.push({ sourceRecordKey: envelope.sourceRecordKey, frozenPredecessorMatches: predecessorMatches, freshLegacyHashMatches, changedFieldCategories, disposition, reasonCode, requiredWriterCapability: disposition === "SAFE_DOMAIN_UPDATE" ? "TITLE_WHITESPACE_ONLY" : disposition === "CONFLICT" ? changedFieldCategories.join("+") : null, domainHashV2 });
  }
  const count = (disposition: string) => records.filter((record) => record.disposition === disposition).length;
  const artifact = { schemaVersion: 1, artifactId: "phoenix-offers-domain-hash-v2-audit-2026-07-31", generatedFrom: { unifiedScopeManifestHash: capture.manifestHash, rawSnapshotCommitted: false, targetEnvironment: "LOCAL_READ_ONLY" }, total: records.length, frozenPredecessorMatchCount: records.filter((record) => record.frozenPredecessorMatches).length, freshLegacyHashExactCount: records.filter((record) => record.freshLegacyHashMatches).length, lineageTransitionCandidateCount: count("LINEAGE_HASH_TRANSITION"), safeUpdateCount: count("SAFE_DOMAIN_UPDATE"), conflictCount: count("CONFLICT"), blockedCount: count("BLOCKED_INSUFFICIENT_EVIDENCE"), records };
  if (artifact.total !== 63) throw new Error(`AUDIT_SCOPE_MISMATCH:${artifact.total}`);
  writeFileSync(arg("--out"), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify({ total: artifact.total, lineageTransitionCandidateCount: artifact.lineageTransitionCandidateCount, safeUpdateCount: artifact.safeUpdateCount, conflictCount: artifact.conflictCount, blockedCount: artifact.blockedCount }, null, 2));
}

void main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

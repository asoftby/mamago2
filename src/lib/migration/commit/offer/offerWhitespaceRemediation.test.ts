/* eslint-disable @typescript-eslint/no-explicit-any -- deliberately narrow Prisma fakes */
import assert from "node:assert/strict";
import type { MigrationLineage, MigrationRecord, Offer } from "@prisma/client";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import { getLineageActionForRecord } from "../../ledger";
import { normalizeSingleLineText } from "../../text/normalizeSingleLineText";
import { buildOfferCreateDraft } from "./buildOfferCreateDraft";
import { OfferCommitRunner, hasOnlyOfferTitleWhitespaceDiff } from "./OfferCommitRunner";
import { OfferCommitWriter } from "./OfferCommitWriter";
import type { OfferCommitContext } from "./types";

const sourceRecordKey = "wordpress-db:hb-programs:18932";
const dirtyTitle = "Пакет:\u00a0 «Комфорт»";
const cleanTitle = "Пакет: «Комфорт»";
const context: OfferCommitContext = { placeId: "place_1", legacyPlaceId: 18886, ownerUserId: "user_1", businessId: null, cityId: "city_1", mediaPolicy: "NONE" };
const candidate = (): NormalizedOfferCandidate => ({
  sourceRecordKey, sourcePostId: 18932, sourcePostType: "hb-programs", sourceStatus: "publish", legacyAuthorId: 1,
  publishedAt: "2025-01-01", modifiedAt: "2025-01-02", title: dirtyTitle, slug: "paket-komfort",
  content: "line one\n  line two", excerpt: "", shortDescription: null, priceText: "10", priceTextRaw: "10",
  averageCheck: { raw: "10", parsed: 10 }, durationMinutes: { raw: null, parsed: null }, maxGuests: { raw: null, parsed: null },
  classificationStatus: "UNCLASSIFIED", sourceTerms: [], placeRelation: { status: "SINGLE_PLACE_RELATION", placeSourcePostIds: [18886], relations: [{ post_id: 18932, related_post_id: 18886, related_post_type: "places", relation_key: "post-relation-hb-programs", relation_order: 0, relation_side: "parent" }] },
  booking: { raw: null, parsed: null, schemaVariant: null }, ageTerms: [], media: { galleryAttachmentIds: [], coverAttachmentId: null },
  seo: { title: null, description: null, focusKeyword: null, canonicalUrl: null, robots: null, ogTitle: null, ogDescription: null }, oldSlugs: [], rawMeta: {},
});
const offer = (overrides: Partial<Offer> = {}): Offer => ({
  id: "offer_1", placeId: "place_1", createRequestId: sourceRecordKey, kind: "SERVICE", productType: null,
  title: dirtyTitle, description: "line one\n  line two", status: "DRAFT", priceFrom: 10, priceText: "10",
  ageMinMonths: null, ageMaxMonths: null, contactPhone: null, contactWebsite: null, seoTitle: null,
  seoDescription: null, seoCanonicalUrl: null, seoRobots: null, seoOgTitle: null, seoOgDescription: null,
  updatedAt: new Date("2026-07-22T10:17:14.475Z"),
  ...overrides,
} as Offer);

async function main(): Promise<void> {
  assert.equal(normalizeSingleLineText("A\u00a0 B"), "A B");
  assert.equal(normalizeSingleLineText("A   B"), "A B");
  assert.equal(normalizeSingleLineText("A\u202fB"), "A B");
  assert.equal(normalizeSingleLineText("  «Кириллица»  "), "«Кириллица»");
  assert.equal(normalizeSingleLineText(dirtyTitle), cleanTitle);

  const built = buildOfferCreateDraft({ candidate: candidate(), context });
  assert.equal(built.ok, true); if (!built.ok) throw new Error("fixture blocked");
  assert.equal(built.draft.title, cleanTitle);
  assert.deepEqual([...built.draft.title].map(character => character.codePointAt(0)), [1055,1072,1082,1077,1090,58,32,171,1050,1086,1084,1092,1086,1088,1090,187]);
  assert.equal(built.draft.description, "line one\n  line two", "rich/multiline content must remain unchanged");
  assert.equal(hasOnlyOfferTitleWhitespaceDiff(offer(), { candidate: candidate(), context }), true);
  assert.equal(hasOnlyOfferTitleWhitespaceDiff(offer({ priceFrom: 11 }), { candidate: candidate(), context }), false);

  const casCalls: any[] = [];
  const writer = new OfferCommitWriter({ offer: { create: async () => offer(), updateMany: async (args: any) => { casCalls.push(args); return { count: 1 }; } } as any });
  const cas = await writer.updateOfferTitleCas({ id: "offer_1", expectedTitle: dirtyTitle, expectedUpdatedAt: offer().updatedAt, placeId: "place_1", newTitle: cleanTitle });
  assert.equal(cas.ok, true);
  assert.deepEqual(casCalls[0].data, { title: cleanTitle });
  assert.deepEqual(Object.keys(casCalls[0].where).sort(), ["id","kind","placeId","productType","status","title","updatedAt"].sort());
  const blockedWriter = new OfferCommitWriter({ offer: { create: async () => offer(), updateMany: async () => ({ count: 0 }) } as any });
  assert.equal((await blockedWriter.updateOfferTitleCas({ id: "offer_1", expectedTitle: dirtyTitle, expectedUpdatedAt: offer().updatedAt, placeId: "place_1", newTitle: cleanTitle })).ok, false);

  const record = { id: "record_2", sourceId: "source_1", sourceEntityType: "wordpress-db:hb-programs", sourceStableKey: sourceRecordKey, sourceRecordKey, sourceHash: built.canonicalHash, runId: "run_2" } as MigrationRecord;
  const lineage = { id: "lineage_1", sourceId: "source_1", sourceRecordKey, targetType: "OFFER", targetId: "offer_1", lastSourceHash: "old-hash", lastImportedAt: new Date("2026-07-22T10:17:14.485Z"), isActive: true } as MigrationLineage;
  let orchestratorCalls = 0, createLineageCalls = 0, lineageUpdates = 0;
  const recordUpdates: any[] = [];
  const runner = new OfferCommitRunner({
    orchestrator: { execute: async input => { orchestratorCalls++; assert.equal(input.action, "UPDATE"); assert.equal(input.updateCas?.expectedTitle, dirtyTitle); return { ok: true, status: "UPDATED", offerId: "offer_1", canonicalHash: built.canonicalHash, warnings: [] }; } },
    lineageWriter: { createLineage: async () => { createLineageCalls++; throw new Error("must not create lineage"); } },
    prisma: { offer: { findUnique: async () => offer() } as any, migrationLineage: { findMany: async () => [lineage], update: async () => { lineageUpdates++; return lineage; } } as any, migrationRecord: { update: async (args: any) => { recordUpdates.push(args); return record; } } as any },
  });
  const operation = { recordId: record.id, sourceRecordKey, targetType: "OFFER", action: "UPDATE", order: 0, dependsOn: [], rollbackSteps: [] } as const;
  const result = await runner.execute({ operation, candidate: candidate(), context, migrationRecord: record });
  assert.equal(result.ok, true); assert.equal(orchestratorCalls, 1); assert.equal(createLineageCalls, 0); assert.equal(lineageUpdates, 1); assert.equal(recordUpdates.at(-1).data.status, "LINKED");

  let blockedCalls = 0;
  const missingLineageRunner = new OfferCommitRunner({ orchestrator: { execute: async () => { blockedCalls++; throw new Error("must not write"); } }, lineageWriter: { createLineage: async () => { throw new Error("must not write"); } }, prisma: { offer: { findUnique: async () => offer() } as any, migrationLineage: { findMany: async () => [], update: async () => lineage } as any, migrationRecord: { update: async () => record } as any } });
  assert.equal((await missingLineageRunner.execute({ operation, candidate: candidate(), context, migrationRecord: record })).ok, false);
  assert.equal(blockedCalls, 0);
  const conflictingLineageRunner = new OfferCommitRunner({ orchestrator: { execute: async () => { blockedCalls++; throw new Error("must not write"); } }, lineageWriter: { createLineage: async () => { throw new Error("must not write"); } }, prisma: { offer: { findUnique: async () => offer() } as any, migrationLineage: { findMany: async () => [lineage, { ...lineage, id: "lineage_2", targetId: "other" }], update: async () => lineage } as any, migrationRecord: { update: async () => record } as any } });
  assert.equal((await conflictingLineageRunner.execute({ operation, candidate: candidate(), context, migrationRecord: record })).ok, false);
  assert.equal(blockedCalls, 0);

  const updatedLineage = { ...lineage, lastSourceHash: built.canonicalHash } as MigrationLineage;
  assert.equal(getLineageActionForRecord({ lineage: [updatedLineage], targetType: "OFFER", sourceHash: built.canonicalHash }), "SKIP_UNCHANGED");
  console.log("offer whitespace remediation tests: OK");
}
main().catch(error => { console.error("offer whitespace remediation tests: FAILED", error); process.exitCode = 1; });

import assert from "node:assert/strict";
import { buildOfferDomainHashV2, buildOfferExecutionPolicyHashV1, executeLineageHashTransition, planOfferHashTransition } from "./offerDomainHash";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";

const candidate = { sourceRecordKey: "wordpress-db:hb-programs:1", title: "  Test  ", slug: "test", content: "Body", shortDescription: null, excerpt: "", averageCheck: { parsed: 10 }, priceText: "10 BYN", ageTerms: [], booking: { raw: null, schemaVariant: null }, media: { coverAttachmentId: 7, galleryAttachmentIds: [8] }, rawMeta: {}, seo: { title: null, description: null, canonicalUrl: null, robots: null, ogTitle: null, ogDescription: null } } as unknown as NormalizedOfferCandidate;
const deps = { placeSourceRecordKey: "wordpress-db:places:2", ownerIdentity: { kind: "technicalMigrationCreator", value: "technicalMigrationCreator" } as const, businessSourceKey: "place-owner-business:wordpress-db:places:2" };

async function main(): Promise<void> {
assert.equal(buildOfferDomainHashV2(candidate, deps), buildOfferDomainHashV2(candidate, deps));
assert.notEqual(buildOfferDomainHashV2(candidate, deps), buildOfferDomainHashV2({ ...candidate, title: "Changed" }, deps));
assert.equal(buildOfferDomainHashV2(candidate, deps), buildOfferDomainHashV2(candidate, { ...deps }));
assert.equal(buildOfferDomainHashV2(candidate, deps), buildOfferDomainHashV2({ ...candidate, targetId: "local-target", storagePath: "/tmp/local" } as unknown as NormalizedOfferCandidate, deps));
const none = buildOfferExecutionPolicyHashV1({ environment: "LOCAL", mediaPolicy: "NONE", binaryUploadAllowed: false, metadataOnly: false });
const metadata = buildOfferExecutionPolicyHashV1({ environment: "DEV", mediaPolicy: "METADATA", binaryUploadAllowed: false, metadataOnly: true });
const full = buildOfferExecutionPolicyHashV1({ environment: "PROD", mediaPolicy: "FULL", binaryUploadAllowed: true, metadataOnly: false });
assert.notEqual(none, metadata); assert.notEqual(metadata, full);
assert.equal(planOfferHashTransition({ lineageCount: 1, targetCount: 1, predecessorMatches: true, targetDomainMatches: true, supportedUpdate: false }), "LINEAGE_HASH_TRANSITION");
assert.equal(planOfferHashTransition({ lineageCount: 2, targetCount: 1, predecessorMatches: true, targetDomainMatches: true, supportedUpdate: false }), "CONFLICT");
assert.equal(planOfferHashTransition({ lineageCount: 1, targetCount: 1, predecessorMatches: false, targetDomainMatches: true, supportedUpdate: false }), "BLOCKED_INSUFFICIENT_EVIDENCE");
assert.equal(planOfferHashTransition({ lineageCount: 1, targetCount: 1, predecessorMatches: true, targetDomainMatches: false, supportedUpdate: true }), "SAFE_DOMAIN_UPDATE");
let lineageCalls = 0; const offerRowWriteCalls = 0;
assert.deepEqual(await executeLineageHashTransition({ disposition: "LINEAGE_HASH_TRANSITION", sourceRecordKey: candidate.sourceRecordKey, expectedPredecessorHash: "legacy", domainHashV2: "v2", updateLineageCas: async () => { lineageCalls += 1; return { updatedCount: 1 }; } }), { outcome: "LINEAGE_HASH_TRANSITION" });
assert.equal(lineageCalls, 1); assert.equal(offerRowWriteCalls, 0);
assert.deepEqual(await executeLineageHashTransition({ disposition: "LINEAGE_HASH_TRANSITION", sourceRecordKey: candidate.sourceRecordKey, expectedPredecessorHash: "stale", domainHashV2: "v2", updateLineageCas: async () => ({ updatedCount: 0 }) }), { outcome: "FAILED", reasonCode: "PREDECESSOR_CAS_FAILED" });
console.log("offerDomainHash tests: OK");
}
void main();

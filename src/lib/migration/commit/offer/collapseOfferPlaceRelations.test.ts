import assert from "node:assert/strict";
import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import type { WordPressOfferPlaceRelationRow } from "../../adapters/wordpress-db/types";
import { buildOfferCreateDraft } from "./buildOfferCreateDraft";
import { collapseOfferPlaceRelations } from "./collapseOfferPlaceRelations";
import type { OfferCommitContext } from "./types";

const offerPostId = 15941;
const row = (placeId = 8901, relationKey = "post-relation", relationSide: "parent" | "child" = "parent"): WordPressOfferPlaceRelationRow => ({
  post_id: offerPostId,
  related_post_id: placeId,
  related_post_type: "places",
  relation_key: relationKey,
  relation_order: 0,
  relation_side: relationSide,
});
const candidate = (relations: readonly WordPressOfferPlaceRelationRow[], sourcePostType: "hb-programs" | "services" = "hb-programs"): NormalizedOfferCandidate => ({
  sourceRecordKey: `wordpress-db:${sourcePostType}:${offerPostId}`, sourcePostId: offerPostId, sourcePostType, sourceStatus: "publish", legacyAuthorId: 1,
  publishedAt: "2026-01-01", modifiedAt: "2026-01-01", title: "Class D", slug: "class-d", content: "", excerpt: "", shortDescription: null,
  priceText: null, priceTextRaw: null, averageCheck: { raw: null, parsed: null }, durationMinutes: { raw: null, parsed: null }, maxGuests: { raw: null, parsed: null },
  classificationStatus: "UNCLASSIFIED", sourceTerms: [], placeRelation: { status: relations.length === 0 ? "NO_PLACE_RELATION" : relations.length === 1 ? "SINGLE_PLACE_RELATION" : "MULTIPLE_PLACE_RELATIONS", placeSourcePostIds: relations.map((value) => value.related_post_id), relations },
  booking: { raw: null, parsed: null, schemaVariant: null }, ageTerms: [], media: { galleryAttachmentIds: [], coverAttachmentId: null },
  seo: { title: null, description: null, focusKeyword: null, canonicalUrl: null, robots: null, ogTitle: null, ogDescription: null }, oldSlugs: [], rawMeta: {},
});
const context: OfferCommitContext = { placeId: "place-8901", legacyPlaceId: 8901, ownerUserId: "owner", businessId: null, cityId: "city", mediaPolicy: "NONE" };

const single = collapseOfferPlaceRelations({ offerPostId, relations: [row()] });
assert.equal(single.status, "RESOLVED");
const identical = collapseOfferPlaceRelations({ offerPostId, relations: [row(), row()] });
assert.equal(identical.status, "RESOLVED"); if (identical.status === "RESOLVED") assert.equal(identical.deduplicatedRowCount, 1);
const parallel = [row(8901, "z-key"), row(8901, "a-key", "child")];
const forward = collapseOfferPlaceRelations({ offerPostId, relations: parallel });
const reverse = collapseOfferPlaceRelations({ offerPostId, relations: [...parallel].reverse() });
assert.deepEqual(forward, reverse, "row order must not affect collapsed evidence");

const draftForward = buildOfferCreateDraft({ candidate: candidate(parallel), context });
const draftReverse = buildOfferCreateDraft({ candidate: candidate([...parallel].reverse()), context });
const draftDuplicate = buildOfferCreateDraft({ candidate: candidate([...parallel, parallel[0]]), context });
assert.equal(draftForward.ok, true); assert.equal(draftReverse.ok, true); assert.equal(draftDuplicate.ok, true);
if (draftForward.ok && draftReverse.ok && draftDuplicate.ok) {
  assert.equal(draftForward.canonicalHash, draftReverse.canonicalHash);
  assert.equal(draftForward.canonicalHash, draftDuplicate.canonicalHash);
}

const ambiguous = collapseOfferPlaceRelations({ offerPostId, relations: [row(8901), row(8902)] });
assert.equal(ambiguous.status, "AMBIGUOUS");
assert.equal(collapseOfferPlaceRelations({ offerPostId, relations: [] }).status, "MISSING");
const invalid = collapseOfferPlaceRelations({ offerPostId, relations: [{ ...row(), relation_side: "sideways" as "parent" }] });
assert.equal(invalid.status, "INVALID");
assert.equal(collapseOfferPlaceRelations({ offerPostId, relations: [{ ...row(), post_id: offerPostId + 1 }] }).status, "INVALID");

const blockedAmbiguous = buildOfferCreateDraft({ candidate: candidate([row(8901), row(8902)]), context });
assert.equal(blockedAmbiguous.ok, false);
const blockedMissing = buildOfferCreateDraft({ candidate: candidate([]), context });
assert.equal(blockedMissing.ok, false);
const blockedAlias = buildOfferCreateDraft({ candidate: { ...candidate([row()]), sourcePostType: "offers" as "hb-programs" }, context });
assert.equal(blockedAlias.ok, false);

const oldSingleHash = buildOfferCreateDraft({ candidate: candidate([row()]), context });
const repeatedSingleHash = buildOfferCreateDraft({ candidate: candidate([row()]), context });
assert.equal(oldSingleHash.ok, true); assert.equal(repeatedSingleHash.ok, true);
if (oldSingleHash.ok && repeatedSingleHash.ok) assert.equal(oldSingleHash.canonicalHash, repeatedSingleHash.canonicalHash);

console.log("offer relation collapse tests: OK");

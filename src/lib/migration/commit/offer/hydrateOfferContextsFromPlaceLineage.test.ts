import assert from "node:assert/strict";

import type { NormalizedOfferCandidate } from "../../adapters/wordpress-db/normalizeOffer";
import type { WordPressOfferPlaceRelationRow } from "../../adapters/wordpress-db/types";
import { hydrateOfferContextsFromPlaceLineage } from "./hydrateOfferContextsFromPlaceLineage";

const relation: WordPressOfferPlaceRelationRow = {
  post_id: 15941,
  related_post_id: 8901,
  related_post_type: "places",
  relation_key: "post-relation",
  relation_order: 0,
  relation_side: "parent",
};

const candidate: NormalizedOfferCandidate = {
  sourceRecordKey: "wordpress-db:hb-programs:15941",
  sourcePostId: 15941,
  sourcePostType: "hb-programs",
  sourceStatus: "publish",
  legacyAuthorId: 1,
  publishedAt: "2026-01-01",
  modifiedAt: "2026-01-01",
  title: "Class D",
  slug: "class-d",
  content: "",
  excerpt: "",
  shortDescription: null,
  priceText: null,
  priceTextRaw: null,
  averageCheck: { raw: null, parsed: null },
  durationMinutes: { raw: null, parsed: null },
  maxGuests: { raw: null, parsed: null },
  classificationStatus: "UNCLASSIFIED",
  sourceTerms: [],
  placeRelation: {
    status: "SINGLE_PLACE_RELATION",
    placeSourcePostIds: [8901],
    relations: [relation],
  },
  booking: { raw: null, parsed: null, schemaVariant: null },
  ageTerms: [],
  media: { galleryAttachmentIds: [22], coverAttachmentId: 11 },
  seo: {
    title: null,
    description: null,
    focusKeyword: null,
    canonicalUrl: null,
    robots: null,
    ogTitle: null,
    ogDescription: null,
  },
  oldSlugs: [],
  rawMeta: {},
};

async function main() {
{
  const result = await hydrateOfferContextsFromPlaceLineage({
    records: [{ sourceRecordKey: candidate.sourceRecordKey, candidate }],
    contextConfig: { defaults: {} },
    mediaPolicyName: "FULL",
    prisma: {
      migrationLineage: {
        findMany: async () => [{ targetId: "place-8901" }],
      } as never,
      place: {
        findUnique: async () => ({
          id: "place-8901",
          createdByUserId: "owner-1",
          ownerBusinessId: "biz-1",
          cityId: "city-1",
        }),
      } as never,
    },
  });
  assert.equal(result.overridesBySourceRecordKey?.[candidate.sourceRecordKey]?.offer?.placeId, "place-8901");
  assert.equal(result.overridesBySourceRecordKey?.[candidate.sourceRecordKey]?.offer?.ownerUserId, "owner-1");
  assert.equal(result.overridesBySourceRecordKey?.[candidate.sourceRecordKey]?.offer?.mediaPolicy, "FULL");
}

{
  const missing = await hydrateOfferContextsFromPlaceLineage({
    records: [{ sourceRecordKey: candidate.sourceRecordKey, candidate }],
    contextConfig: { defaults: {} },
    mediaPolicyName: "FULL",
    prisma: {
      migrationLineage: { findMany: async () => [] } as never,
      place: { findUnique: async () => null } as never,
    },
  });
  assert.equal(missing.overridesBySourceRecordKey?.[candidate.sourceRecordKey], undefined);
}

{
  // No Place relation rows at all in the source (the 28 legacy Offers case)
  // — allowed through as an explicit all-null placeless override, never
  // hitting migrationLineage/place lookups since there is nothing to look up.
  const noRelationCandidate: NormalizedOfferCandidate = {
    ...candidate,
    sourceRecordKey: "wordpress-db:hb-programs:99999",
    sourcePostId: 99999,
    placeRelation: { status: "SINGLE_PLACE_RELATION", placeSourcePostIds: [], relations: [] },
  };
  let lineageCalled = false;
  const result = await hydrateOfferContextsFromPlaceLineage({
    records: [{ sourceRecordKey: noRelationCandidate.sourceRecordKey, candidate: noRelationCandidate }],
    contextConfig: { defaults: {} },
    mediaPolicyName: "FULL",
    prisma: {
      migrationLineage: { findMany: async () => { lineageCalled = true; return []; } } as never,
      place: { findUnique: async () => null } as never,
    },
  });
  const offerContext = result.overridesBySourceRecordKey?.[noRelationCandidate.sourceRecordKey]?.offer;
  assert.equal(lineageCalled, false);
  assert.equal(offerContext?.placeId, null);
  assert.equal(offerContext?.legacyPlaceId, null);
  assert.equal(offerContext?.ownerUserId, null);
  assert.equal(offerContext?.businessId, null);
  assert.equal(offerContext?.cityId, null);
  assert.equal(offerContext?.mediaPolicy, "FULL");
}

console.log("hydrateOfferContextsFromPlaceLineage tests: OK");
}

void main();

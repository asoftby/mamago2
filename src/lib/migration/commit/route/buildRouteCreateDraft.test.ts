import assert from "node:assert/strict";

import { buildRouteCreateDraft } from "./buildRouteCreateDraft";
import type { NormalizedRouteCandidate, RouteCommitContext } from "./buildRouteCreateDraft";

function candidateFixture(overrides: Partial<NormalizedRouteCandidate> = {}): NormalizedRouteCandidate {
  return {
    title: "Family Route",
    slug: "family-route",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    stops: [
      { index: 2, title: "Second", description: "Second note", imageAttachmentIds: [202], placeId: null },
      { index: 1, title: "First", description: "First note", imageAttachmentIds: [101], placeId: null },
    ],
    locationRaw: '{"address":"Minsk"}',
    location: { address: "Minsk", latitude: null, longitude: null },
    media: { featuredAttachmentId: 900 },
    seo: { title: "SEO Route", focusKeyword: "route" },
    sourceTerms: [],
    rawMeta: {},
    ...overrides,
  };
}

function contextFixture(overrides: Partial<RouteCommitContext> = {}): RouteCommitContext {
  return { cityId: "city-1", ...overrides };
}

function testBuildsDraftWithPrivateDraftNoAuthor() {
  const result = buildRouteCreateDraft({
    candidate: candidateFixture(),
    context: contextFixture(),
    sourceRecordKey: "wordpress-db:routes:701",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.status, "DRAFT");
  assert.equal(result.draft.visibility, "PRIVATE");
  assert.equal(result.draft.authorId, null);
  assert.equal(result.draft.cityId, "city-1");
  assert.equal(result.draft.seoTitle, "SEO Route");
}

function testStopsAreOrderedAndMappedWithoutMedia() {
  const result = buildRouteCreateDraft({ candidate: candidateFixture(), context: contextFixture() });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.draft.stops, [
    { order: 1, placeId: null, customTitle: "First", note: "First note" },
    { order: 2, placeId: null, customTitle: "Second", note: "Second note" },
  ]);
  assert.ok(!("imageAttachmentIds" in result.draft.stops[0]));
  assert.ok(!("photoUrl" in result.draft.stops[0]));
}

function testMissingCityLeavesNullAndWarns() {
  const result = buildRouteCreateDraft({
    candidate: candidateFixture(),
    context: {},
    sourceRecordKey: "wordpress-db:routes:701",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.cityId, null);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0].code, "ROUTE_CITY_UNRESOLVED");
  assert.equal(result.warnings[0].sourceRecordKey, "wordpress-db:routes:701");
}

function testBlocksMissingRequiredFields() {
  const result = buildRouteCreateDraft({
    candidate: candidateFixture({ title: " ", slug: "", stops: [] }),
    context: contextFixture(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.reasons.map((reason) => reason.code),
    ["MISSING_TITLE", "MISSING_SLUG", "MISSING_STOPS"],
  );
}

function main() {
  testBuildsDraftWithPrivateDraftNoAuthor();
  testStopsAreOrderedAndMappedWithoutMedia();
  testMissingCityLeavesNullAndWarns();
  testBlocksMissingRequiredFields();
}

main();
console.log("buildRouteCreateDraft tests: OK");

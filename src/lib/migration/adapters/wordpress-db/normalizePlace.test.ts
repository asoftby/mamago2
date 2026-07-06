import assert from "node:assert/strict";

import { normalizePlace, type NormalizedPlaceCandidate } from "./normalizePlace";
import type { WordPressPlaceBundle, WordPressPostRow, WordPressTermRow } from "./types";

function payloadOf(record: ReturnType<typeof normalizePlace>): NormalizedPlaceCandidate {
  return record.normalizedPayload as NormalizedPlaceCandidate;
}

const basePost: WordPressPostRow = {
  ID: 301,
  post_author: 5,
  post_date: "2026-01-01 00:00:00",
  post_content: "<p>Place desc</p>",
  post_title: "Cool Place",
  post_excerpt: "A cool place excerpt",
  post_status: "publish",
  post_name: "cool-place",
  post_modified: "2026-01-02 00:00:00",
  post_parent: 0,
  guid: "https://example.com/?p=301",
  post_type: "places",
  post_mime_type: "",
};

const placeTerms: WordPressTermRow[] = [
  { post_id: 301, term_id: 20, name: "Playground", slug: "playground", taxonomy: "places_category" },
  { post_id: 301, term_id: 21, name: "Age 3-6", slug: "age-3-6", taxonomy: "age" },
];

function buildBundle(overrides: Partial<WordPressPlaceBundle> = {}): WordPressPlaceBundle {
  return {
    post: basePost,
    postMeta: {
      "short-desc-place": ["A great place for kids"],
      phone: ["+375291234567"],
      email: ["hello@example.com"],
      work_hours: ["Mon-Fri 9-18"],
      location: ["Minsk, some street"],
      "city-place": ["Minsk"],
      gallery: ["111", "222", "333"],
      _thumbnail_id: ["555"],
      rank_math_title: ["SEO Title"],
      rank_math_focus_keyword: ["kids playground"],
    },
    terms: placeTerms,
    placeIndex: { post_id: 301, post_status: "publish", priority: 5, lat: 53.9, lng: 27.5667 },
    ...overrides,
  };
}

function testFullPlace() {
  const record = normalizePlace(buildBundle());

  assert.equal(record.sourceRecordKey, "wordpress-db:places:301");
  assert.equal(record.sourceEntityType, "wordpress-db:places");
  assert.equal(record.targetTypeHint, "PLACE");

  const payload = payloadOf(record);
  assert.equal(payload.title, "Cool Place");
  assert.equal(payload.slug, "cool-place");
  assert.equal(payload.content, "<p>Place desc</p>");
  assert.equal(payload.excerpt, "A cool place excerpt");
  assert.equal(payload.status, "publish");
  assert.equal(payload.publishedAt, "2026-01-01 00:00:00");
  assert.equal(payload.modifiedAt, "2026-01-02 00:00:00");
  assert.equal(payload.shortDescription, "A great place for kids");
  assert.equal(payload.phone, "+375291234567");
  assert.equal(payload.email, "hello@example.com");
  assert.equal(payload.workHoursRaw, "Mon-Fri 9-18");
  assert.equal(payload.locationRaw, "Minsk, some street");
  assert.equal(payload.cityRaw, "Minsk");
  assert.deepEqual(payload.coordinates, { lat: 53.9, lng: 27.5667 });
  assert.deepEqual(payload.seo, { title: "SEO Title", focusKeyword: "kids playground" });

  assert.deepEqual(record.mediaRefs, ["555", "111", "222", "333"]);
  assert.deepEqual(record.relationRefs, [
    "term:places_category:playground",
    "term:age:age-3-6",
  ]);

  // No coordinates/logo warnings expected for a fully-populated place.
  assert.deepEqual(record.warnings, []);
}

function testMissingCoordinatesWarnsNotErrors() {
  const withoutPlaceIndex = normalizePlace(buildBundle({ placeIndex: null }));
  assert.equal(payloadOf(withoutPlaceIndex).coordinates, null);
  assert.equal(withoutPlaceIndex.warnings?.length, 1);
  assert.equal(withoutPlaceIndex.warnings?.[0]?.code, "PLACE_MISSING_COORDINATES");
  assert.equal(withoutPlaceIndex.warnings?.[0]?.severity, "WARNING");

  const withNullLatLng = normalizePlace(
    buildBundle({
      placeIndex: { post_id: 301, post_status: "publish", priority: 5, lat: null, lng: null },
    }),
  );
  assert.equal(payloadOf(withNullLatLng).coordinates, null);
  assert.equal(withNullLatLng.warnings?.[0]?.code, "PLACE_MISSING_COORDINATES");
}

function testRepeatedGalleryValuesPreserved() {
  const record = normalizePlace(buildBundle());
  const payload = payloadOf(record);
  assert.deepEqual(payload.media.galleryAttachmentIds, [111, 222, 333]);
}

function testLogoExcludedFromMediaOnlyWarned() {
  const record = normalizePlace(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        logo: ["999"],
      },
    }),
  );

  const payload = payloadOf(record);
  assert.equal(payload.media.thumbnailAttachmentId, 555);
  assert.deepEqual(payload.media.galleryAttachmentIds, [111, 222, 333]);
  assert.ok(!record.mediaRefs?.includes("999"));

  const logoWarning = record.warnings?.find((warning) => warning.code === "PLACE_LOGO_EXCLUDED");
  assert.ok(logoWarning);
  assert.deepEqual(logoWarning?.details?.logoAttachmentIds, ["999"]);
}

function testCategoryTermsNotMappedKeptAsSourceReferences() {
  const record = normalizePlace(buildBundle());
  const payload = payloadOf(record);
  assert.deepEqual(payload.sourceTerms, [
    { termId: 20, taxonomy: "places_category", name: "Playground", slug: "playground" },
    { termId: 21, taxonomy: "age", name: "Age 3-6", slug: "age-3-6" },
  ]);
  assert.deepEqual(record.relationRefs, [
    "term:places_category:playground",
    "term:age:age-3-6",
  ]);
}

function testEmptyOrBrokenMetaDoesNotThrow() {
  const record = normalizePlace(
    buildBundle({ postMeta: {}, terms: [], placeIndex: null }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.shortDescription, null);
  assert.equal(payload.phone, null);
  assert.equal(payload.coordinates, null);
  assert.equal(payload.media.thumbnailAttachmentId, null);
  assert.deepEqual(payload.media.galleryAttachmentIds, []);
  assert.deepEqual(payload.sourceTerms, []);
  assert.deepEqual(payload.rawMeta, {});
  assert.deepEqual(record.mediaRefs, []);
  assert.deepEqual(record.relationRefs, []);
  assert.equal(record.warnings?.length, 1);
  assert.equal(record.warnings?.[0]?.code, "PLACE_MISSING_COORDINATES");

  // Non-numeric gallery/thumbnail values must be dropped, not thrown.
  const withGarbageIds = normalizePlace(
    buildBundle({
      postMeta: { gallery: ["abc", "222", ""], _thumbnail_id: ["not-a-number"] },
    }),
  );
  const garbagePayload = payloadOf(withGarbageIds);
  assert.equal(garbagePayload.media.thumbnailAttachmentId, null);
  assert.deepEqual(garbagePayload.media.galleryAttachmentIds, [222]);
}

function main() {
  testFullPlace();
  testMissingCoordinatesWarnsNotErrors();
  testRepeatedGalleryValuesPreserved();
  testLogoExcludedFromMediaOnlyWarned();
  testCategoryTermsNotMappedKeptAsSourceReferences();
  testEmptyOrBrokenMetaDoesNotThrow();
}

main();
console.log("normalizePlace tests: OK");

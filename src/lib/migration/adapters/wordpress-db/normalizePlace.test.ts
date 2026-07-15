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
      work_hours: [
        '[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"hours","hours":[{"from":"09:00","to":"18:00"}]}]',
      ],
      location: ["Minsk, some street"],
      "city-place": ["Minsk"],
      cover: ["555"],
      gallery: ["111,222,333"],
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
  assert.equal(payload.phoneE164, "+375291234567");
  assert.equal(payload.email, "hello@example.com");
  assert.equal(
    payload.workHoursRaw,
    '[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"hours","hours":[{"from":"09:00","to":"18:00"}]}]',
  );
  assert.equal(payload.openingHours?.mode, "WEEKLY");
  assert.equal(payload.openingHours?.rules.length, 7);
  assert.ok(payload.openingHours?.rules.every((r) => r.isOpen));
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

/**
 * `Place.phone` must never receive raw non-E.164 text. Confirmed live
 * (2026-07-14 readiness audit): target Place 437 was already imported with
 * literal `"+375 (25) 530-00-53"` before this fix — this is a regression
 * test against that exact case, not a hypothetical.
 */
function testLegacyFormattedPhoneNormalizedWithoutWarning() {
  const record = normalizePlace(
    buildBundle({ postMeta: { ...buildBundle().postMeta, phone: ["+375 (25) 530-00-53"] } }),
  );
  const payload = payloadOf(record);
  // Raw evidence preserved verbatim...
  assert.equal(payload.phone, "+375 (25) 530-00-53");
  // ...and the safe-to-write value is the normalized E.164.
  assert.equal(payload.phoneE164, "+375255300053");
  assert.ok(!record.warnings?.some((w) => w.code === "PLACE_PHONE_INVALID"));
}

function testInvalidPhoneWarnsAndKeepsRawEvidenceWithNullE164() {
  const record = normalizePlace(
    buildBundle({ postMeta: { ...buildBundle().postMeta, phone: ["not a phone at all"] } }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.phone, "not a phone at all", "raw evidence never lost");
  assert.equal(payload.phoneE164, null, "never a best-effort/garbage value");

  const warning = record.warnings?.find((w) => w.code === "PLACE_PHONE_INVALID");
  assert.ok(warning);
  assert.equal(warning?.severity, "WARNING");
  assert.equal(warning?.details?.phoneRaw, "not a phone at all");
}

function testInvalidWorkHoursJsonWarnsWithSourceRecordKey() {
  const record = normalizePlace(
    buildBundle({ postMeta: { ...buildBundle().postMeta, work_hours: ["Mon-Fri 9-18"] } }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.workHoursRaw, "Mon-Fri 9-18", "raw evidence preserved even when unparseable");
  assert.equal(payload.openingHours, null);

  const warning = record.warnings?.find((w) => w.code === "PLACE_WORK_HOURS_JSON_INVALID");
  assert.ok(warning);
  assert.equal(warning?.severity, "WARNING");
  assert.equal(warning?.sourceRecordKey, "wordpress-db:places:301");
}

function testAppointmentsOnlyWorkHoursPropagatesAsByAppointmentMode() {
  const record = normalizePlace(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        work_hours: [
          '[{"days":["mon","tue","wed","thu","fri","sat","sun"],"status":"appointments_only","hours":[]}]',
        ],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.openingHours?.mode, "BY_APPOINTMENT");
  assert.ok(!record.warnings?.some((w) => w.code?.startsWith("PLACE_WORK_HOURS_")));
}

function testEmptyOrBrokenMetaDoesNotThrow() {
  const record = normalizePlace(
    buildBundle({ postMeta: {}, terms: [], placeIndex: null }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.shortDescription, null);
  assert.equal(payload.phone, null);
  assert.equal(payload.phoneE164, null);
  // Absent phone must not warn — only present-but-invalid does.
  assert.ok(!record.warnings?.some((w) => w.code === "PLACE_PHONE_INVALID"));
  assert.equal(payload.workHoursRaw, null);
  assert.equal(payload.openingHours, null);
  assert.ok(!record.warnings?.some((w) => w.code?.startsWith("PLACE_WORK_HOURS_")));
  assert.equal(payload.coordinates, null);
  assert.equal(payload.media.thumbnailAttachmentId, null);
  assert.deepEqual(payload.media.galleryAttachmentIds, []);
  assert.deepEqual(payload.sourceTerms, []);
  assert.deepEqual(payload.rawMeta, {});
  assert.deepEqual(record.mediaRefs, []);
  assert.deepEqual(record.relationRefs, []);
  assert.equal(record.warnings?.length, 1);
  assert.equal(record.warnings?.[0]?.code, "PLACE_MISSING_COORDINATES");

  // Non-numeric gallery/cover-fallback values must be dropped, not thrown.
  const withGarbageIds = normalizePlace(
    buildBundle({
      postMeta: { gallery: ["abc", "222", ""], _thumbnail_id: ["not-a-number"] },
    }),
  );
  const garbagePayload = payloadOf(withGarbageIds);
  assert.equal(garbagePayload.media.thumbnailAttachmentId, null);
  assert.deepEqual(garbagePayload.media.galleryAttachmentIds, [222]);
  const invalidWarning = withGarbageIds.warnings?.find((w) => w.code === "PLACE_MEDIA_ID_INVALID");
  assert.ok(invalidWarning, "invalid tokens must be reported, not silently dropped");
  assert.deepEqual(invalidWarning?.details?.invalid, [
    { field: "_thumbnail_id", token: "not-a-number" },
    { field: "gallery", token: "abc" },
  ]);
}

// ---------------------------------------------------------------------------
// Place cover/gallery source fidelity (2026-07-15 fix — real meta keys/shapes).
// ---------------------------------------------------------------------------

function testCoverReadFromPrimaryCoverKey() {
  const record = normalizePlace(buildBundle({ postMeta: { ...buildBundle().postMeta, cover: ["5406"] } }));
  const payload = payloadOf(record);
  assert.equal(payload.media.thumbnailAttachmentId, 5406);
  assert.ok(!record.warnings?.some((w) => w.code === "PLACE_MEDIA_LEGACY_KEY_USED"));
  assert.ok(!record.warnings?.some((w) => w.code === "PLACE_MEDIA_COVER_CONFLICT"));
}

function testThumbnailIdUsedAsDocumentedFallbackWhenCoverAbsent() {
  const metaWithoutCover = { ...buildBundle().postMeta } as Record<string, readonly string[]>;
  delete metaWithoutCover.cover;
  const record = normalizePlace(
    buildBundle({ postMeta: { ...metaWithoutCover, _thumbnail_id: ["777"] } }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.media.thumbnailAttachmentId, 777);

  const warning = record.warnings?.find((w) => w.code === "PLACE_MEDIA_LEGACY_KEY_USED" && w.details?.legacyKey === "_thumbnail_id");
  assert.ok(warning, "using the fallback must be flagged");
  assert.equal(warning?.severity, "INFO");
  assert.equal(warning?.details?.merged, true);
}

/**
 * `cover` present-but-malformed must never be treated the same as `cover`
 * genuinely absent — a present-but-unparseable primary must not silently
 * fall through to `_thumbnail_id`, since that would misreport a broken
 * primary as a clean absent-primary substitution. Found by review
 * (PR #47, chatgpt-codex-connector) before merge.
 */
function testMalformedCoverNeverFallsThroughToThumbnailId() {
  const record = normalizePlace(
    buildBundle({ postMeta: { ...buildBundle().postMeta, cover: ["not-a-number"], _thumbnail_id: ["777"] } }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.media.thumbnailAttachmentId, null, "a malformed primary cover must stay unresolved, never silently replaced");
  assert.ok(
    !record.warnings?.some((w) => w.code === "PLACE_MEDIA_LEGACY_KEY_USED"),
    "cover was present (just malformed), so this is not a legacy-fallback situation",
  );
  const invalidWarning = record.warnings?.find((w) => w.code === "PLACE_MEDIA_ID_INVALID");
  assert.ok(invalidWarning, "the malformed cover token itself must still be reported");
  assert.ok(
    (invalidWarning?.details?.invalid as { field: string; token: string }[]).some(
      (entry) => entry.field === "cover" && entry.token === "not-a-number",
    ),
  );
}

function testCoverAndThumbnailIdConflictPrefersCoverAndWarns() {
  const record = normalizePlace(
    buildBundle({ postMeta: { ...buildBundle().postMeta, cover: ["100"], _thumbnail_id: ["200"] } }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.media.thumbnailAttachmentId, 100, "primary cover always wins on conflict");

  const conflict = record.warnings?.find((w) => w.code === "PLACE_MEDIA_COVER_CONFLICT");
  assert.ok(conflict);
  assert.equal(conflict?.severity, "WARNING");
  assert.deepEqual(conflict?.details, { coverAttachmentId: 100, thumbnailAttachmentId: 200 });
}

function testCoverAndThumbnailIdAgreeingProducesNoConflictWarning() {
  const record = normalizePlace(
    buildBundle({ postMeta: { ...buildBundle().postMeta, cover: ["555"], _thumbnail_id: ["555"] } }),
  );
  assert.ok(!record.warnings?.some((w) => w.code === "PLACE_MEDIA_COVER_CONFLICT"));
}

function testCommaSeparatedGalleryParsedInOrder() {
  const record = normalizePlace(
    buildBundle({ postMeta: { ...buildBundle().postMeta, gallery: ["10,20,30"] } }),
  );
  assert.deepEqual(payloadOf(record).media.galleryAttachmentIds, [10, 20, 30]);
}

function testLegacyGalleryPlaceKeptAsEvidenceNeverMergedIntoGallery() {
  const record = normalizePlace(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        gallery: ["111,222,333"],
        "gallery-place": ["999,888"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.deepEqual(payload.media.galleryAttachmentIds, [111, 222, 333], "legacy gallery-place must never be blended in");
  assert.deepEqual(payload.rawMeta["gallery-place"], ["999,888"], "raw evidence is still preserved");

  const warning = record.warnings?.find((w) => w.code === "PLACE_MEDIA_LEGACY_KEY_USED" && w.details?.legacyKey === "gallery-place");
  assert.ok(warning);
  assert.equal(warning?.severity, "INFO");
  assert.equal(warning?.details?.merged, false);
}

function testLegacyLogoPlaceKeptAsEvidenceWarned() {
  const record = normalizePlace(
    buildBundle({ postMeta: { ...buildBundle().postMeta, "logo-place": ["765"] } }),
  );
  const warning = record.warnings?.find((w) => w.code === "PLACE_MEDIA_LEGACY_KEY_USED" && w.details?.legacyKey === "logo-place");
  assert.ok(warning);
  assert.deepEqual(warning?.details?.rawValues, ["765"]);
}

function testNoMediaAtAllProducesNoMediaWarnings() {
  const metaWithoutMedia = { ...buildBundle().postMeta } as Record<string, readonly string[]>;
  delete metaWithoutMedia.cover;
  delete metaWithoutMedia.gallery;
  const record = normalizePlace(buildBundle({ postMeta: metaWithoutMedia }));
  const payload = payloadOf(record);
  assert.equal(payload.media.thumbnailAttachmentId, null);
  assert.deepEqual(payload.media.galleryAttachmentIds, []);
  assert.ok(!record.warnings?.some((w) => w.code?.startsWith("PLACE_MEDIA_")));
}

function testDeterministicMediaOutputAcrossRepeatedCalls() {
  const bundle = buildBundle({
    postMeta: { ...buildBundle().postMeta, cover: ["100"], _thumbnail_id: ["200"], gallery: ["1,2,abc,1"] },
  });
  const first = normalizePlace(bundle);
  const second = normalizePlace(bundle);
  assert.deepEqual(first, second);
}

// Golden Places from the sampled media policy allowlist (2026-07-15 source audit).
function testGoldenPlace5389HasExpectedSourceMediaIds() {
  const record = normalizePlace(
    buildBundle({
      post: { ...basePost, ID: 5389 },
      postMeta: {
        cover: ["5406"],
        gallery: ["5391,5392,5393,5394,5395,5396,5397,5398,5399,5400,5401,5402,5403,5404"],
        logo: ["5390"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.media.thumbnailAttachmentId, 5406);
  assert.equal(payload.media.galleryAttachmentIds.length, 14);
  assert.ok(record.warnings?.some((w) => w.code === "PLACE_LOGO_EXCLUDED"));
}

function testGoldenPlace895HasGalleryButNoCover() {
  const record = normalizePlace(
    buildBundle({
      post: { ...basePost, ID: 895 },
      postMeta: { gallery: ["1604,10537,10538,7952,7959,7960,7961,10539,10540,10541"] },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.media.thumbnailAttachmentId, null);
  assert.equal(payload.media.galleryAttachmentIds.length, 10);
}

function testGoldenPlace43023HasCoverLogoAndGalleryWithOverlap() {
  const record = normalizePlace(
    buildBundle({
      post: { ...basePost, ID: 43023 },
      postMeta: {
        cover: ["43025"],
        gallery: ["43026,43027,43028,43029,43030,43025,43031,43032,43033,43034,43035"],
        logo: ["43024"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.media.thumbnailAttachmentId, 43025);
  assert.equal(payload.media.galleryAttachmentIds.length, 11);
  assert.ok(payload.media.galleryAttachmentIds.includes(43025), "the real source data has this overlap, not a bug");
  assert.ok(!record.warnings?.some((w) => w.code === "PLACE_MEDIA_COVER_CONFLICT"), "no _thumbnail_id present, so no conflict");
}

function main() {
  testFullPlace();
  testMissingCoordinatesWarnsNotErrors();
  testRepeatedGalleryValuesPreserved();
  testLogoExcludedFromMediaOnlyWarned();
  testCategoryTermsNotMappedKeptAsSourceReferences();
  testLegacyFormattedPhoneNormalizedWithoutWarning();
  testInvalidPhoneWarnsAndKeepsRawEvidenceWithNullE164();
  testInvalidWorkHoursJsonWarnsWithSourceRecordKey();
  testAppointmentsOnlyWorkHoursPropagatesAsByAppointmentMode();
  testEmptyOrBrokenMetaDoesNotThrow();

  testCoverReadFromPrimaryCoverKey();
  testThumbnailIdUsedAsDocumentedFallbackWhenCoverAbsent();
  testMalformedCoverNeverFallsThroughToThumbnailId();
  testCoverAndThumbnailIdConflictPrefersCoverAndWarns();
  testCoverAndThumbnailIdAgreeingProducesNoConflictWarning();
  testCommaSeparatedGalleryParsedInOrder();
  testLegacyGalleryPlaceKeptAsEvidenceNeverMergedIntoGallery();
  testLegacyLogoPlaceKeptAsEvidenceWarned();
  testNoMediaAtAllProducesNoMediaWarnings();
  testDeterministicMediaOutputAcrossRepeatedCalls();
  testGoldenPlace5389HasExpectedSourceMediaIds();
  testGoldenPlace895HasGalleryButNoCover();
  testGoldenPlace43023HasCoverLogoAndGalleryWithOverlap();
}

main();
console.log("normalizePlace tests: OK");

import assert from "node:assert/strict";

import { normalizeOffer, type NormalizedOfferCandidate } from "./normalizeOffer";
import type { WordPressOfferBundle, WordPressOfferPlaceRelationRow, WordPressPostRow } from "./types";

function payloadOf(record: ReturnType<typeof normalizeOffer>): NormalizedOfferCandidate {
  return record.normalizedPayload as NormalizedOfferCandidate;
}

// Modeled on real, sanitized shapes from the 2026-07-14 read-only source
// inventory (post 15941-style hb-program: program-cost/average-check/
// booking-settings/gallery all present).
const hbProgramPost: WordPressPostRow = {
  ID: 601,
  post_author: 5,
  post_date: "2026-01-01 00:00:00",
  post_content: "<p>Camp program description</p>",
  post_title: "Kids Camp Program",
  post_excerpt: "",
  post_status: "publish",
  post_name: "kids-camp-program",
  post_modified: "2026-01-02 00:00:00",
  post_parent: 0,
  guid: "https://example.com/?p=601",
  post_type: "hb-programs",
  post_mime_type: "",
};

const servicesPost: WordPressPostRow = {
  ...hbProgramPost,
  ID: 602,
  post_title: "Шоу и артисты «Jokers»",
  post_name: "show-and-artists-jokers",
  post_type: "services",
};

const singlePlaceRelation: WordPressOfferPlaceRelationRow = {
  post_id: 601,
  related_post_id: 301,
  related_post_type: "places",
  relation_key: "post-relation-hb-programs",
  relation_order: 0,
  relation_side: "child",
};

const secondPlaceRelation: WordPressOfferPlaceRelationRow = {
  post_id: 601,
  related_post_id: 302,
  related_post_type: "places",
  relation_key: "post-relation-hb-programs",
  relation_order: 1,
  relation_side: "child",
};

function buildBundle(overrides: Partial<WordPressOfferBundle> = {}): WordPressOfferBundle {
  return {
    post: hbProgramPost,
    postMeta: {
      "program-cost": ["<ul><li>300 byn - до 10 чел</li></ul>"],
      "average-check-program": ["385"],
      "hb-program-duration": ["180"],
      "max-guests-program": ["15"],
      gallery: ["18929,26663"],
      "program-booking-settings": ['{"enabled":true,"base_price":300,"calendar":{"excluded_weekdays":[]}}'],
      "short-description": ["<p>Аква-вечеринка для детей</p>"],
      logo: ["8902"],
      rank_math_title: ["Camp SEO Title"],
      rank_math_description: ["Camp SEO description"],
      rank_math_focus_keyword: ["kids camp"],
      rank_math_canonical_url: ["https://example.com/kids-camp-program"],
      rank_math_robots: ["index,follow"],
      rank_math_facebook_title: ["Camp OG Title"],
      rank_math_facebook_description: ["Camp OG description"],
      _wp_old_slug: ["old-camp-slug"],
    },
    terms: [
      { post_id: 601, term_id: 60, name: "Аниматоры", slug: "animatory", taxonomy: "org-capacity" },
      { post_id: 601, term_id: 61, name: "7-9 лет", slug: "7-9-let", taxonomy: "program-age" },
    ],
    placeRelations: [singlePlaceRelation],
    ...overrides,
  };
}

function testFullHbProgramCandidate() {
  const record = normalizeOffer(buildBundle());

  assert.equal(record.sourceRecordKey, "wordpress-db:hb-programs:601");
  assert.equal(record.sourceEntityType, "wordpress-db:hb-programs");
  assert.equal(record.targetTypeHint, "OFFER");

  const payload = payloadOf(record);
  assert.equal(payload.sourceRecordKey, "wordpress-db:hb-programs:601");
  assert.equal(payload.sourcePostId, 601);
  assert.equal(payload.sourcePostType, "hb-programs");
  assert.equal(payload.sourceStatus, "publish");
  assert.equal(payload.legacyAuthorId, 5);
  assert.equal(payload.title, "Kids Camp Program");
  assert.equal(payload.slug, "kids-camp-program");

  // No classification of any kind — the whole point of this PR.
  assert.equal(payload.classificationStatus, "UNCLASSIFIED");
  assert.ok(!("productType" in payload));
  assert.ok(!("kind" in payload));
  assert.ok(!("category" in payload));

  assert.equal(payload.priceTextRaw, "<ul><li>300 byn - до 10 чел</li></ul>");
  assert.equal(payload.priceText, "300 byn - до 10 чел");

  assert.deepEqual(payload.averageCheck, { raw: "385", parsed: 385 });
  assert.deepEqual(payload.durationMinutes, { raw: "180", parsed: 180 });
  assert.deepEqual(payload.maxGuests, { raw: "15", parsed: 15 });

  assert.equal(payload.placeRelation.status, "SINGLE_PLACE_RELATION");
  assert.deepEqual(payload.placeRelation.placeSourcePostIds, [301]);

  assert.equal(payload.booking.raw, '{"enabled":true,"base_price":300,"calendar":{"excluded_weekdays":[]}}');
  assert.equal(payload.booking.schemaVariant, "CALENDAR_ADDITIONS");
  assert.ok(payload.booking.parsed);

  assert.deepEqual(
    payload.ageTerms.map((t) => t.slug),
    ["7-9-let"],
  );
  assert.deepEqual(payload.ageTerms[0].parsedMonths, { minMonths: 84, maxMonths: 108 });

  assert.deepEqual(payload.media.galleryAttachmentIds, [18929, 26663]);
  assert.equal(payload.media.coverAttachmentId, 8902);
  assert.deepEqual(record.mediaRefs, ["8902", "18929", "26663"]);

  assert.equal(payload.seo.title, "Camp SEO Title");
  assert.equal(payload.seo.description, "Camp SEO description");
  assert.equal(payload.seo.canonicalUrl, "https://example.com/kids-camp-program");
  assert.equal(payload.seo.ogTitle, "Camp OG Title");
  assert.deepEqual(payload.oldSlugs, ["old-camp-slug"]);

  // No OFFER_SERVICES_MANUAL_REVIEW for hb-programs.
  assert.ok(!record.warnings?.some((w) => w.code === "OFFER_SERVICES_MANUAL_REVIEW"));
}

function testServicesCandidateGetsManualReviewMarker() {
  const record = normalizeOffer(
    buildBundle({
      post: servicesPost,
      postMeta: {
        "main-image-service": ["7001"],
        "phone-services": ["+375291112233"],
      },
      placeRelations: [],
    }),
  );

  assert.equal(record.sourceRecordKey, "wordpress-db:services:602");
  assert.equal(record.sourceEntityType, "wordpress-db:services");

  const payload = payloadOf(record);
  assert.equal(payload.sourcePostType, "services");
  assert.equal(payload.classificationStatus, "UNCLASSIFIED");
  assert.equal(payload.media.coverAttachmentId, 7001);

  const warning = record.warnings?.find((w) => w.code === "OFFER_SERVICES_MANUAL_REVIEW");
  assert.ok(warning, "services source must always be flagged for manual review");
  assert.equal(warning?.severity, "INFO");
}

function testNoPlaceRelation() {
  const record = normalizeOffer(buildBundle({ placeRelations: [] }));
  const payload = payloadOf(record);

  assert.equal(payload.placeRelation.status, "NO_PLACE_RELATION");
  assert.deepEqual(payload.placeRelation.placeSourcePostIds, []);
  assert.ok(record.warnings?.some((w) => w.code === "OFFER_NO_PLACE_RELATION" && w.severity === "INFO"));
}

function testSinglePlaceRelation() {
  const record = normalizeOffer(buildBundle({ placeRelations: [singlePlaceRelation] }));
  const payload = payloadOf(record);

  assert.equal(payload.placeRelation.status, "SINGLE_PLACE_RELATION");
  assert.deepEqual(payload.placeRelation.placeSourcePostIds, [301]);
  assert.ok(!record.warnings?.some((w) => w.code === "OFFER_MULTIPLE_PLACE_RELATIONS"));
}

function testMultiplePlaceRelationsNeverPickPrimary() {
  const record = normalizeOffer(
    buildBundle({ placeRelations: [singlePlaceRelation, secondPlaceRelation] }),
  );
  const payload = payloadOf(record);

  assert.equal(payload.placeRelation.status, "MULTIPLE_PLACE_RELATIONS");
  // Both relations preserved, in repository order — never narrowed to one.
  assert.deepEqual(payload.placeRelation.placeSourcePostIds, [301, 302]);
  assert.equal(payload.placeRelation.relations.length, 2);

  const warning = record.warnings?.find((w) => w.code === "OFFER_MULTIPLE_PLACE_RELATIONS");
  assert.ok(warning);
  assert.equal(warning?.severity, "WARNING");
  assert.deepEqual(warning?.details?.placeSourcePostIds, [301, 302]);
}

function testTitleContentShortDescriptionFallback() {
  // hb-programs uses "short-description"; services uses "short-description-service".
  const recordHb = normalizeOffer(
    buildBundle({ postMeta: { "short-description": ["<p>HB short desc</p>"] } }),
  );
  assert.equal(payloadOf(recordHb).shortDescription, "<p>HB short desc</p>");

  const recordSvc = normalizeOffer(
    buildBundle({
      post: servicesPost,
      postMeta: { "short-description-service": ["<p>Service short desc</p>"] },
    }),
  );
  assert.equal(payloadOf(recordSvc).shortDescription, "<p>Service short desc</p>");

  const recordNeither = normalizeOffer(buildBundle({ postMeta: {} }));
  assert.equal(payloadOf(recordNeither).shortDescription, null);

  // content/excerpt come straight from post.* — never stripped, unlike priceText.
  assert.equal(payloadOf(recordHb).content, "<p>Camp program description</p>");
}

function testProgramCostHtmlCleanup() {
  const record = normalizeOffer(
    buildBundle({
      postMeta: {
        "program-cost": ["<p>Понедельник &ndash; Четверг (макс. 15 чел.) &mdash; 510 руб.<br />Пятница — 570 руб.</p>"],
      },
    }),
  );
  const payload = payloadOf(record);
  // This normalizer only strips tags/collapses whitespace — it does not
  // decode HTML entities (that's a later content-pipeline concern).
  assert.ok(!payload.priceText?.includes("<"));
  assert.ok(!payload.priceText?.includes(">"));
  assert.equal(payload.priceTextRaw, "<p>Понедельник &ndash; Четверг (макс. 15 чел.) &mdash; 510 руб.<br />Пятница — 570 руб.</p>");
}

function testValidAndInvalidPrice() {
  const valid = normalizeOffer(buildBundle({ postMeta: { "average-check-program": ["620"] } }));
  assert.deepEqual(payloadOf(valid).averageCheck, { raw: "620", parsed: 620 });
  assert.ok(!valid.warnings?.some((w) => w.code === "OFFER_PRICE_INVALID"));

  const invalid = normalizeOffer(buildBundle({ postMeta: { "average-check-program": ["не число"] } }));
  assert.deepEqual(payloadOf(invalid).averageCheck, { raw: "не число", parsed: null });
  const warning = invalid.warnings?.find((w) => w.code === "OFFER_PRICE_INVALID");
  assert.ok(warning);
  assert.equal(warning?.details?.raw, "не число");

  const absent = normalizeOffer(buildBundle({ postMeta: {} }));
  assert.deepEqual(payloadOf(absent).averageCheck, { raw: null, parsed: null });
  // Absent (not just invalid) must not warn — it's a legitimately optional field.
  assert.ok(!absent.warnings?.some((w) => w.code === "OFFER_PRICE_INVALID"));
}

function testDurationAndMaxGuests() {
  const record = normalizeOffer(
    buildBundle({
      postMeta: {
        "hb-program-duration": ["not-a-duration"],
        "max-guests-program": ["twenty"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.deepEqual(payload.durationMinutes, { raw: "not-a-duration", parsed: null });
  assert.deepEqual(payload.maxGuests, { raw: "twenty", parsed: null });
  assert.ok(record.warnings?.some((w) => w.code === "OFFER_DURATION_INVALID"));
  assert.ok(record.warnings?.some((w) => w.code === "OFFER_MAX_GUESTS_INVALID"));

  const valid = normalizeOffer(
    buildBundle({ postMeta: { "hb-program-duration": ["60"], "max-guests-program": ["0"] } }),
  );
  assert.deepEqual(payloadOf(valid).durationMinutes, { raw: "60", parsed: 60 });
  // 0 is a legitimate non-negative number, not an error.
  assert.deepEqual(payloadOf(valid).maxGuests, { raw: "0", parsed: 0 });
}

/** All 6 real `program-age` terms confirmed live 2026-07-14. */
function testAllRealProgramAgeTerms() {
  const cases: Array<{ name: string; slug: string; expectedMonths: { minMonths: number; maxMonths: number | null } | null }> = [
    { name: "до года", slug: "0-1", expectedMonths: { minMonths: 0, maxMonths: 12 } },
    { name: "1-3 года", slug: "1-3-goda", expectedMonths: { minMonths: 12, maxMonths: 36 } },
    { name: "4-6 лет", slug: "4-6-let", expectedMonths: null },
    { name: "7-9 лет", slug: "7-9-let", expectedMonths: { minMonths: 84, maxMonths: 108 } },
    { name: "10-12 лет", slug: "10-12-let", expectedMonths: null },
    { name: "12+", slug: "12", expectedMonths: null },
  ];

  for (const testCase of cases) {
    const record = normalizeOffer(
      buildBundle({
        terms: [{ post_id: 601, term_id: 99, name: testCase.name, slug: testCase.slug, taxonomy: "program-age" }],
      }),
    );
    const payload = payloadOf(record);
    assert.equal(payload.ageTerms.length, 1, `expected exactly one age term for "${testCase.name}"`);
    assert.deepEqual(
      payload.ageTerms[0].parsedMonths,
      testCase.expectedMonths,
      `unexpected months for "${testCase.name}"`,
    );
    if (testCase.expectedMonths === null) {
      assert.ok(
        record.warnings?.some((w) => w.code === "OFFER_AGE_TERM_UNKNOWN"),
        `expected OFFER_AGE_TERM_UNKNOWN for "${testCase.name}"`,
      );
    } else {
      assert.ok(!record.warnings?.some((w) => w.code === "OFFER_AGE_TERM_UNKNOWN"));
    }
  }
}

function testUnknownAgeTermNeverInventsABoundary() {
  const record = normalizeOffer(
    buildBundle({
      terms: [{ post_id: 601, term_id: 77, name: "школьники", slug: "shkolniki", taxonomy: "program-age" }],
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.ageTerms[0].parsedMonths, null);
  assert.equal(payload.ageTerms[0].name, "школьники");
  const warning = record.warnings?.find((w) => w.code === "OFFER_AGE_TERM_UNKNOWN");
  assert.ok(warning);
  assert.equal(warning?.severity, "INFO");
}

function testGalleryWithDuplicatesAndMalformedIds() {
  const record = normalizeOffer(
    buildBundle({ postMeta: { gallery: ["18929,26663,18929,not-an-id"] } }),
  );
  const payload = payloadOf(record);
  // Exact-value dedup, stable order — 18929 kept only once, at first position.
  assert.deepEqual(payload.media.galleryAttachmentIds, [18929, 26663]);
  const warning = record.warnings?.find((w) => w.code === "OFFER_MEDIA_ID_INVALID");
  assert.ok(warning);
  assert.equal(warning?.details?.value, "not-an-id");
}

function testRankMathAndOldSlug() {
  const record = normalizeOffer(buildBundle());
  const payload = payloadOf(record);
  assert.equal(payload.seo.focusKeyword, "kids camp");
  assert.equal(payload.seo.robots, "index,follow");
  assert.equal(payload.seo.ogDescription, "Camp OG description");
  assert.deepEqual(payload.oldSlugs, ["old-camp-slug"]);
}

function testValidBookingJsonBothKnownSchemaVariants() {
  const calendarVariant = normalizeOffer(
    buildBundle({
      postMeta: {
        "program-booking-settings": [
          '{"enabled":true,"base_price":300,"calendar":{"make_available_next":365,"excluded_weekdays":["mon"]},"additions":{}}',
        ],
      },
    }),
  );
  assert.equal(payloadOf(calendarVariant).booking.schemaVariant, "CALENDAR_ADDITIONS");
  assert.ok(payloadOf(calendarVariant).booking.parsed);

  const productTableVariant = normalizeOffer(
    buildBundle({
      postMeta: {
        "program-booking-settings": [
          '{"product_type":"table","enabled":true,"booking":{"availability":{"max_days":365}},"base_price":{"amount":300}}',
        ],
      },
    }),
  );
  assert.equal(payloadOf(productTableVariant).booking.schemaVariant, "PRODUCT_TABLE_BOOKING");
  assert.ok(payloadOf(productTableVariant).booking.parsed);

  for (const record of [calendarVariant, productTableVariant]) {
    assert.ok(!record.warnings?.some((w) => w.code === "OFFER_BOOKING_JSON_MALFORMED"));
    assert.ok(!record.warnings?.some((w) => w.code === "OFFER_BOOKING_SCHEMA_UNKNOWN"));
  }
}

function testMalformedBookingJson() {
  const record = normalizeOffer(
    buildBundle({ postMeta: { "program-booking-settings": ['{"enabled":true, "base_price":'] } }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.booking.raw, '{"enabled":true, "base_price":');
  assert.equal(payload.booking.parsed, null);
  assert.equal(payload.booking.schemaVariant, null);
  assert.ok(record.warnings?.some((w) => w.code === "OFFER_BOOKING_JSON_MALFORMED"));
  // No OfferSession-equivalent field must exist anywhere on the candidate.
  assert.ok(!("sessions" in payload));
}

function testUnknownButValidBookingJsonSchema() {
  const record = normalizeOffer(
    buildBundle({ postMeta: { "program-booking-settings": ['{"some_future_shape":true}'] } }),
  );
  const payload = payloadOf(record);
  assert.ok(payload.booking.parsed);
  assert.equal(payload.booking.schemaVariant, "UNKNOWN");
  const warning = record.warnings?.find((w) => w.code === "OFFER_BOOKING_SCHEMA_UNKNOWN");
  assert.ok(warning);
  assert.equal(warning?.severity, "INFO");
}

function testEmptyOptionalFieldsDoNotWarnNoisily() {
  const record = normalizeOffer(buildBundle({ postMeta: {}, terms: [], placeRelations: [] }));
  const payload = payloadOf(record);

  assert.equal(payload.priceText, null);
  assert.equal(payload.priceTextRaw, null);
  assert.deepEqual(payload.averageCheck, { raw: null, parsed: null });
  assert.deepEqual(payload.durationMinutes, { raw: null, parsed: null });
  assert.deepEqual(payload.maxGuests, { raw: null, parsed: null });
  assert.equal(payload.booking.raw, null);
  assert.deepEqual(payload.media.galleryAttachmentIds, []);
  assert.equal(payload.media.coverAttachmentId, null);
  assert.deepEqual(payload.oldSlugs, []);
  assert.deepEqual(payload.ageTerms, []);

  // Only the expected structural warning (no Place relation) — nothing else fires just because fields are absent.
  const codes = (record.warnings ?? []).map((w) => w.code);
  assert.deepEqual(codes, ["OFFER_NO_PLACE_RELATION"]);
}

function testStableSourceRecordKey() {
  const hb = normalizeOffer(buildBundle());
  const svc = normalizeOffer(buildBundle({ post: { ...hbProgramPost, ID: 602, post_type: "services" } }));
  assert.equal(hb.sourceRecordKey, "wordpress-db:hb-programs:601");
  assert.equal(svc.sourceRecordKey, "wordpress-db:services:602");
  assert.notEqual(hb.sourceRecordKey, svc.sourceRecordKey);
}

function testDeterministicResult() {
  const bundle = buildBundle({ placeRelations: [singlePlaceRelation, secondPlaceRelation] });
  const first = normalizeOffer(bundle);
  const second = normalizeOffer(bundle);
  assert.deepEqual(first, second);
}

/**
 * Repository already reverses MySQL batch-mode escaping (PR #38/#39) — this
 * normalizer must not touch escape sequences at all, it just passes text
 * through. A value that's already a real newline (post-fix shape) must stay
 * a real newline, not get mangled into anything else.
 */
function testAlreadyUnescapedValuesPassThroughUnchanged() {
  const record = normalizeOffer(
    buildBundle({
      postMeta: {
        "program-cost": ["<p>Line one</p>\n<p>Line two</p>"],
        "short-description": ["Contains a literal backslash: \\ and a real newline:\nend"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.ok(payload.priceText?.includes("Line one"));
  assert.ok(payload.priceText?.includes("Line two"));
  assert.equal(payload.shortDescription, "Contains a literal backslash: \\ and a real newline:\nend");
}

function testGoldenWhitespaceTitleNormalization() {
  const record = normalizeOffer(buildBundle({ post: { ...hbProgramPost, ID: 18932, post_title: "Пакет:\u00a0 «Комфорт»" } }));
  const title = payloadOf(record).title;
  assert.equal(title, "Пакет: «Комфорт»");
  assert.deepEqual([...title].map(character => character.codePointAt(0)), [1055,1072,1082,1077,1090,58,32,171,1050,1086,1084,1092,1086,1088,1090,187]);
}

async function main() {
  testFullHbProgramCandidate();
  testServicesCandidateGetsManualReviewMarker();
  testNoPlaceRelation();
  testSinglePlaceRelation();
  testMultiplePlaceRelationsNeverPickPrimary();
  testTitleContentShortDescriptionFallback();
  testProgramCostHtmlCleanup();
  testValidAndInvalidPrice();
  testDurationAndMaxGuests();
  testAllRealProgramAgeTerms();
  testUnknownAgeTermNeverInventsABoundary();
  testGalleryWithDuplicatesAndMalformedIds();
  testRankMathAndOldSlug();
  testValidBookingJsonBothKnownSchemaVariants();
  testMalformedBookingJson();
  testUnknownButValidBookingJsonSchema();
  testEmptyOptionalFieldsDoNotWarnNoisily();
  testStableSourceRecordKey();
  testDeterministicResult();
  testAlreadyUnescapedValuesPassThroughUnchanged();
  testGoldenWhitespaceTitleNormalization();
}

main()
  .then(() => {
    console.log("normalizeOffer tests: OK");
  })
  .catch((error) => {
    console.error("normalizeOffer tests: FAILED", error);
    process.exitCode = 1;
  });

import assert from "node:assert/strict";

import { normalizeEvent, type NormalizedEventCandidate } from "./normalizeEvent";
import type { WordPressEventBundle, WordPressPostRow, WordPressTermRow } from "./types";

function payloadOf(record: ReturnType<typeof normalizeEvent>): NormalizedEventCandidate {
  return record.normalizedPayload as NormalizedEventCandidate;
}

const basePost: WordPressPostRow = {
  ID: 401,
  post_author: 5,
  post_date: "2026-01-01 00:00:00",
  post_content: "<p>Event desc</p>",
  post_title: "Kids Fest",
  post_excerpt: "A fun kids event",
  post_status: "publish",
  post_name: "kids-fest",
  post_modified: "2026-01-02 00:00:00",
  post_parent: 0,
  guid: "https://example.com/?p=401",
  post_type: "events",
  post_mime_type: "",
};

const eventTerms: WordPressTermRow[] = [
  { post_id: 401, term_id: 30, name: "Festival", slug: "festival", taxonomy: "events-category" },
  { post_id: 401, term_id: 31, name: "Summer", slug: "summer", taxonomy: "occasion" },
];

function buildBundle(overrides: Partial<WordPressEventBundle> = {}): WordPressEventBundle {
  return {
    post: basePost,
    postMeta: {
      event_date: ["2026-08-15 10:00:00"],
      "event-place-name": ["Central Park"],
      location: ["Minsk, Central Park"],
      "adress-event-place": ["ul. Central, 1"],
      event_city: ["Minsk"],
      "event-cost": ["<p>10 <b>BYN</b></p>"],
      "url-buy-ticket": ["https://tickets.example.com/kids-fest"],
      external_event_id: ["ext-401"],
      external_last_updated: ["2026-01-02 12:00:00"],
      "trailer-url": ["https://video.example.com/trailer.mp4"],
      rank_math_title: ["SEO Title"],
      rank_math_focus_keyword: ["kids fest"],
    },
    terms: eventTerms,
    ...overrides,
  };
}

function testFullEvent() {
  const record = normalizeEvent(buildBundle());

  assert.equal(record.sourceRecordKey, "wordpress-db:events:401");
  assert.equal(record.sourceEntityType, "wordpress-db:events");
  assert.equal(record.targetTypeHint, "ACTIVITY");

  const payload = payloadOf(record);
  assert.equal(payload.title, "Kids Fest");
  assert.equal(payload.slug, "kids-fest");
  assert.equal(payload.content, "<p>Event desc</p>");
  assert.equal(payload.excerpt, "A fun kids event");
  assert.equal(payload.status, "publish");
  assert.equal(payload.publishedAt, "2026-01-01 00:00:00");
  assert.equal(payload.modifiedAt, "2026-01-02 00:00:00");
  assert.equal(payload.venueNameRaw, "Central Park");
  assert.equal(payload.locationRaw, "Minsk, Central Park");
  assert.equal(payload.addressEventPlaceRaw, "ul. Central, 1");
  assert.equal(payload.cityRaw, "Minsk");
  assert.equal(payload.priceRaw, "10 BYN");
  assert.equal(payload.ticketUrlRaw, "https://tickets.example.com/kids-fest");
  assert.equal(payload.externalEventId, "ext-401");
  assert.equal(payload.externalLastUpdatedRaw, "2026-01-02 12:00:00");
  assert.equal(payload.trailerUrlRaw, "https://video.example.com/trailer.mp4");
  assert.deepEqual(payload.seo, { title: "SEO Title", focusKeyword: "kids fest" });

  assert.deepEqual(payload.media, { featuredAttachmentId: null, galleryAttachmentIds: [] });
  assert.deepEqual(record.mediaRefs, []);
  assert.deepEqual(record.relationRefs, ["term:events-category:festival", "term:occasion:summer"]);

  // Warning documenting known visibility gap (sessions/nextOccurrenceAt not synced in Phoenix commit yet).
  assert.ok(record.warnings?.some((w) => w.code === "EVENT_DISCOVERY_VISIBILITY_RISK"));
}

function testScheduleDraftOneTime() {
  const record = normalizeEvent(buildBundle({ postMeta: { ...buildBundle().postMeta, event_date: ["2026-08-15 10:00:00"] } }));
  const payload = payloadOf(record);
  assert.deepEqual(payload.eventDatesRaw, ["2026-08-15 10:00:00"]);
  assert.equal(payload.scheduleDraft?.mode, "ONE_TIME");
  assert.deepEqual(payload.scheduleDraft?.dates, ["2026-08-15"]);
  assert.ok(payload.scheduleDraft?.scheduleItems && payload.scheduleDraft.scheduleItems.length === 1);
  assert.equal(payload.scheduleDraft?.scheduleItems?.[0]?.date, "2026-08-15");
  assert.equal(payload.scheduleDraft?.scheduleItems?.[0]?.startTime, "10:00");
  assert.ok(!record.warnings?.some((w) => w.code.startsWith("EVENT_SCHEDULE")));
}

function testScheduleDraftMultiDate() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        event_date: ["2026-08-15 10:00:00", "2026-08-16 10:00:00", "2026-08-17 10:00:00"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.scheduleDraft?.mode, "MULTI_DATE");
  assert.deepEqual(payload.scheduleDraft?.dates, ["2026-08-15", "2026-08-16", "2026-08-17"]);
}

function testScheduleMissingWarns() {
  const record = normalizeEvent(buildBundle({ postMeta: { ...buildBundle().postMeta, event_date: [] } }));
  const payload = payloadOf(record);
  assert.equal(payload.scheduleDraft, null);
  assert.deepEqual(payload.eventDatesRaw, []);
  const warning = record.warnings?.find((w) => w.code === "EVENT_SCHEDULE_MISSING");
  assert.ok(warning);
  assert.equal(warning?.severity, "WARNING");
}

function testScheduleAmbiguousWarns() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        event_date: ["2026-08-15 10:00:00", "not-a-real-date"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.scheduleDraft, null, "any unparseable value blocks the whole schedule draft, not just that entry");
  const warning = record.warnings?.find((w) => w.code === "EVENT_SCHEDULE_AMBIGUOUS");
  assert.ok(warning);
  assert.deepEqual(warning?.details?.eventDatesRaw, ["2026-08-15 10:00:00", "not-a-real-date"]);
}

function testScheduleDraftVoxelJsonArray() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        event_date: [
          '[{"start":"2026-07-12 16:00:00","end":"2026-07-12 17:30:00","multiday":false,"allday":false}]',
        ],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.scheduleDraft?.mode, "ONE_TIME");
  assert.deepEqual(payload.scheduleDraft?.dates, ["2026-07-12"]);
  assert.equal(payload.scheduleDraft?.scheduleItems?.[0]?.date, "2026-07-12");
  assert.ok(!payload.scheduleDraft?.scheduleItems?.[0]?.dateEnd);
  assert.ok(!record.warnings?.some((w) => w.code.startsWith("EVENT_SCHEDULE")));
}

function testScheduleDraftVoxelStartEndPreservesRange() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        event_date: [
          '[{"start":"2026-07-12 16:00:00","end":"2026-07-14 17:30:00","multiday":true,"allday":false}]',
        ],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.scheduleDraft?.mode, "ONE_TIME");
  assert.deepEqual(payload.scheduleDraft?.dates, ["2026-07-12", "2026-07-14"]);
  assert.equal(payload.scheduleDraft?.scheduleItems?.[0]?.date, "2026-07-12");
  assert.equal(payload.scheduleDraft?.scheduleItems?.[0]?.dateEnd, "2026-07-14");
}

function testScheduleDraftVoxelEndBeforeStartNormalizesAndWarns() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        event_date: [
          '[{"start":"2026-07-14 16:00:00","end":"2026-07-12 17:30:00","multiday":true,"allday":false}]',
        ],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.ok(record.warnings?.some((w) => w.code === "EVENT_DATE_RANGE_NORMALIZED"));
  assert.deepEqual(payload.scheduleDraft?.dates, ["2026-07-12", "2026-07-14"]);
  assert.equal(payload.scheduleDraft?.scheduleItems?.[0]?.date, "2026-07-12");
  assert.equal(payload.scheduleDraft?.scheduleItems?.[0]?.dateEnd, "2026-07-14");
}

function testScheduleDraftMalformedEventDateWarnsAmbiguous() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        event_date: ['[{"start": "not-a-date"}]'],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.scheduleDraft, null);
  assert.ok(record.warnings?.some((w) => w.code === "EVENT_SCHEDULE_AMBIGUOUS"));
}

function testScheduleDraftVoxelJsonMultiDate() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        event_date: [
          '[{"start":"2026-06-28 14:00:00","end":"2026-06-28 15:30:00","multiday":false,"allday":false},{"start":"2026-07-19 16:00:00","end":"2026-07-19 17:30:00","multiday":false,"allday":false}]',
        ],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.equal(payload.scheduleDraft?.mode, "MULTI_DATE");
  assert.deepEqual(payload.scheduleDraft?.dates, ["2026-06-28", "2026-07-19"]);
}

function testMediaEvidenceExtractedWhenPresent() {
  const withThumbnail = normalizeEvent(
    buildBundle({ postMeta: { ...buildBundle().postMeta, _thumbnail_id: ["999"] } }),
  );
  assert.deepEqual(payloadOf(withThumbnail).media, { featuredAttachmentId: 999, galleryAttachmentIds: [] });
  assert.deepEqual(withThumbnail.mediaRefs, ["999"]);

  const withGallery = normalizeEvent(
    buildBundle({ postMeta: { ...buildBundle().postMeta, gallery: ["111", "222"] } }),
  );
  assert.deepEqual(payloadOf(withGallery).media, { featuredAttachmentId: null, galleryAttachmentIds: [111, 222] });
  assert.deepEqual(withGallery.mediaRefs, ["111", "222"]);

  const withoutMedia = normalizeEvent(buildBundle());
  assert.ok(!withoutMedia.warnings?.some((w) => w.code.startsWith("EVENT_MEDIA")));
}

function testMediaEvidenceDedupesDuplicateIds() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        _thumbnail_id: ["111"],
        gallery: ["111", "222", "222"],
      },
    }),
  );

  assert.deepEqual(payloadOf(record).media, { featuredAttachmentId: 111, galleryAttachmentIds: [111, 222] });
  assert.deepEqual(record.mediaRefs, ["111", "222"]);
}

function testInvalidMediaSourceWarnsWithoutFailingCandidate() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        _thumbnail_id: ["not-an-id"],
        gallery: ["333", "0", "-1"],
      },
    }),
  );

  assert.deepEqual(payloadOf(record).media, { featuredAttachmentId: null, galleryAttachmentIds: [333] });
  assert.deepEqual(record.mediaRefs, ["333"]);
  const warnings = record.warnings?.filter((w) => w.code === "EVENT_MEDIA_SOURCE_INVALID") ?? [];
  assert.equal(warnings.length, 3);
}

function testEmptyMediaSourceWarnsWithoutFailingCandidate() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        _thumbnail_id: [""],
        gallery: [""],
      },
    }),
  );

  assert.deepEqual(payloadOf(record).media, { featuredAttachmentId: null, galleryAttachmentIds: [] });
  assert.ok(record.warnings?.some((w) => w.code === "EVENT_FEATURED_IMAGE_MISSING"));
  assert.ok(record.warnings?.some((w) => w.code === "EVENT_GALLERY_EMPTY"));
}

function testCategoryOccasionTermsNotMapped() {
  const record = normalizeEvent(buildBundle());
  const payload = payloadOf(record);
  assert.deepEqual(payload.sourceTerms, [
    { termId: 30, taxonomy: "events-category", name: "Festival", slug: "festival", normalizedName: "festival" },
    { termId: 31, taxonomy: "occasion", name: "Summer", slug: "summer", normalizedName: "summer" },
  ]);
}

function testPriceStrippedToPlainText() {
  const record = normalizeEvent(buildBundle());
  assert.equal(payloadOf(record).priceRaw, "10 BYN");

  const withEmptyPrice = normalizeEvent(
    buildBundle({ postMeta: { ...buildBundle().postMeta, "event-cost": ["<p></p>"] } }),
  );
  assert.equal(payloadOf(withEmptyPrice).priceRaw, null);
}

function testEmptyOrBrokenMetaDoesNotThrow() {
  const record = normalizeEvent(buildBundle({ postMeta: {}, terms: [] }));
  const payload = payloadOf(record);
  assert.equal(payload.venueNameRaw, null);
  assert.equal(payload.locationRaw, null);
  assert.equal(payload.addressEventPlaceRaw, null);
  assert.equal(payload.cityRaw, null);
  assert.equal(payload.priceRaw, null);
  assert.equal(payload.ticketUrlRaw, null);
  assert.equal(payload.externalEventId, null);
  assert.equal(payload.trailerUrlRaw, null);
  assert.equal(payload.scheduleDraft, null);
  assert.deepEqual(payload.sourceTerms, []);
  assert.deepEqual(payload.rawMeta, {});
  assert.deepEqual(record.mediaRefs, []);
  assert.deepEqual(record.relationRefs, []);
  assert.equal(record.warnings?.length, 1);
  assert.equal(record.warnings?.[0]?.code, "EVENT_SCHEDULE_MISSING");
}

function testAgeEvidencePlus() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        age: ["3+"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.ok(payload.ageEvidence);
  assert.equal(payload.ageEvidence?.confidence, "MATCHED_HIGH");
  assert.deepEqual(payload.ageEvidence?.parsed, { minYears: 3 });
}

function testAgeEvidenceRange() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        age_text: ["3–7"],
      },
    }),
  );
  const payload = payloadOf(record);
  assert.ok(payload.ageEvidence);
  assert.equal(payload.ageEvidence?.confidence, "MATCHED_HIGH");
  assert.deepEqual(payload.ageEvidence?.parsed, { minYears: 3, maxYears: 7 });
}

function testAgeEvidenceTextMalyshiLowConfidence() {
  const record = normalizeEvent(
    buildBundle({
      post: { ...basePost, post_title: "Концерт для малышей" },
    }),
  );
  const payload = payloadOf(record);
  assert.ok(payload.ageEvidence);
  assert.equal(payload.ageEvidence?.confidence, "MATCHED_LOW");
  assert.ok(record.warnings?.some((w) => w.code === "EVENT_AGE_LOW_CONFIDENCE"));
}

function testAgeEvidenceUnknownWarnsUnmatched() {
  const record = normalizeEvent(
    buildBundle({
      postMeta: {
        ...buildBundle().postMeta,
        age: ["для всей семьи"],
      },
    }),
  );
  assert.ok(record.warnings?.some((w) => w.code === "EVENT_AGE_UNMATCHED"));
}

function main() {
  testFullEvent();
  testScheduleDraftOneTime();
  testScheduleDraftMultiDate();
  testScheduleMissingWarns();
  testScheduleAmbiguousWarns();
  testScheduleDraftVoxelJsonArray();
  testScheduleDraftVoxelStartEndPreservesRange();
  testScheduleDraftVoxelEndBeforeStartNormalizesAndWarns();
  testScheduleDraftMalformedEventDateWarnsAmbiguous();
  testScheduleDraftVoxelJsonMultiDate();
  testMediaEvidenceExtractedWhenPresent();
  testMediaEvidenceDedupesDuplicateIds();
  testInvalidMediaSourceWarnsWithoutFailingCandidate();
  testEmptyMediaSourceWarnsWithoutFailingCandidate();
  testCategoryOccasionTermsNotMapped();
  testPriceStrippedToPlainText();
  testEmptyOrBrokenMetaDoesNotThrow();
  testAgeEvidencePlus();
  testAgeEvidenceRange();
  testAgeEvidenceTextMalyshiLowConfidence();
  testAgeEvidenceUnknownWarnsUnmatched();
}

main();
console.log("normalizeEvent tests: OK");

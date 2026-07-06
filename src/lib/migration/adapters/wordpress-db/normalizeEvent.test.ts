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

  assert.deepEqual(record.mediaRefs, [], "event images are never referenced, even when present in source");
  assert.deepEqual(record.relationRefs, ["term:events-category:festival", "term:occasion:summer"]);

  assert.deepEqual(record.warnings, []);
}

function testScheduleDraftOneTime() {
  const record = normalizeEvent(buildBundle({ postMeta: { ...buildBundle().postMeta, event_date: ["2026-08-15 10:00:00"] } }));
  const payload = payloadOf(record);
  assert.deepEqual(payload.eventDatesRaw, ["2026-08-15 10:00:00"]);
  assert.equal(payload.scheduleDraft?.mode, "ONE_TIME");
  assert.equal(payload.scheduleDraft?.dates.length, 1);
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
  assert.equal(payload.scheduleDraft?.dates.length, 3);
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

function testMediaExcludedWarningWhenPresent() {
  const withThumbnail = normalizeEvent(
    buildBundle({ postMeta: { ...buildBundle().postMeta, _thumbnail_id: ["999"] } }),
  );
  const thumbnailWarning = withThumbnail.warnings?.find((w) => w.code === "EVENT_MEDIA_EXCLUDED");
  assert.ok(thumbnailWarning);
  assert.equal(thumbnailWarning?.severity, "INFO");
  assert.deepEqual(withThumbnail.mediaRefs, []);

  const withGallery = normalizeEvent(
    buildBundle({ postMeta: { ...buildBundle().postMeta, gallery: ["111", "222"] } }),
  );
  assert.ok(withGallery.warnings?.some((w) => w.code === "EVENT_MEDIA_EXCLUDED"));
  assert.deepEqual(withGallery.mediaRefs, []);

  const withoutMedia = normalizeEvent(buildBundle());
  assert.ok(!withoutMedia.warnings?.some((w) => w.code === "EVENT_MEDIA_EXCLUDED"));
}

function testCategoryOccasionTermsNotMapped() {
  const record = normalizeEvent(buildBundle());
  const payload = payloadOf(record);
  assert.deepEqual(payload.sourceTerms, [
    { termId: 30, taxonomy: "events-category", name: "Festival", slug: "festival" },
    { termId: 31, taxonomy: "occasion", name: "Summer", slug: "summer" },
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

function main() {
  testFullEvent();
  testScheduleDraftOneTime();
  testScheduleDraftMultiDate();
  testScheduleMissingWarns();
  testScheduleAmbiguousWarns();
  testMediaExcludedWarningWhenPresent();
  testCategoryOccasionTermsNotMapped();
  testPriceStrippedToPlainText();
  testEmptyOrBrokenMetaDoesNotThrow();
}

main();
console.log("normalizeEvent tests: OK");

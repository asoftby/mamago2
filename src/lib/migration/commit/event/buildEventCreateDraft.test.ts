import assert from "node:assert/strict";

import { buildEventCreateDraft } from "./buildEventCreateDraft";
import type { EventCommitContext, NormalizedEventCandidate } from "./types";

function candidateFixture(overrides: Partial<NormalizedEventCandidate> = {}): NormalizedEventCandidate {
  return {
    title: "Kids Fest",
    slug: "kids-fest",
    content: "<p>A fun kids event with games and music.</p>",
    excerpt: "A fun kids event",
    status: "publish",
    publishedAt: "2026-01-01 00:00:00",
    modifiedAt: "2026-01-02 00:00:00",
    eventDatesRaw: ["2026-08-15 10:00:00"],
    scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-15T10:00:00.000Z"] },
    venueNameRaw: "Central Park",
    locationRaw: "Minsk, Central Park",
    addressEventPlaceRaw: "ul. Central, 1",
    cityRaw: "Minsk",
    priceRaw: "10 BYN",
    ticketUrlRaw: "https://tickets.example.com/kids-fest",
    externalEventId: "ext-401",
    externalLastUpdatedRaw: "2026-01-02 12:00:00",
    trailerUrlRaw: "https://video.example.com/trailer.mp4",
    seo: { title: "SEO Title", focusKeyword: "kids fest" },
    sourceTerms: [{ termId: 30, taxonomy: "events-category", name: "Festival", slug: "festival" }],
    rawMeta: {},
    ...overrides,
  };
}

function contextFixture(overrides: Partial<EventCommitContext> = {}): EventCommitContext {
  return {
    ownerUserId: "user-1",
    ...overrides,
  };
}

function testHappyPath() {
  const result = buildEventCreateDraft({ candidate: candidateFixture(), context: contextFixture() });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.title, "Kids Fest");
  assert.equal(result.draft.shortDesc, "A fun kids event");
  assert.equal(result.draft.description, "<p>A fun kids event with games and music.</p>");
  assert.equal(result.draft.type, "EVENT");
  assert.equal(result.draft.status, "PENDING");
  assert.equal(result.draft.ownerUserId, "user-1");
  assert.equal(result.draft.cityId, null);
  assert.equal(result.draft.placeId, null);
  assert.equal(result.draft.organizerId, null);
  assert.equal(result.draft.eventCategoryId, null);
  assert.equal(result.draft.scheduleMode, "ONE_TIME");
  assert.deepEqual(result.draft.scheduleJson, { mode: "ONE_TIME", dates: ["2026-08-15T10:00:00.000Z"] });
  assert.equal(result.draft.priceText, "10 BYN");
}

function testMissingOwnerBlocked() {
  const result = buildEventCreateDraft({ candidate: candidateFixture(), context: contextFixture({ ownerUserId: "" }) });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "MISSING_OWNER"));
}

function testMissingTitleBlocked() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({ title: "" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "MISSING_TITLE"));
}

function testMissingShortDescBlocked() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({ excerpt: "", content: "" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "MISSING_SHORT_DESC"));
}

function testMissingScheduleBlocked() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({ scheduleDraft: null, eventDatesRaw: [] }),
    context: contextFixture(),
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.some((r) => r.code === "MISSING_SCHEDULE"));
}

function testShortDescFallsBackToContent() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({ excerpt: "", content: "<p>Plain text from content only.</p>" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.shortDesc, "Plain text from content only.");
}

function testShortDescTruncatedWithEllipsis() {
  const longExcerpt = "word ".repeat(60).trim();
  const result = buildEventCreateDraft({
    candidate: candidateFixture({ excerpt: longExcerpt }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.draft.shortDesc.length <= 200);
  assert.ok(result.draft.shortDesc.endsWith("…"));
}

function testContextFieldsCopiedWhenProvided() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture(),
    context: contextFixture({
      cityId: "city-1",
      placeId: "place-1",
      organizerId: "organizer-1",
      eventCategoryId: "category-1",
    }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.cityId, "city-1");
  assert.equal(result.draft.placeId, "place-1");
  assert.equal(result.draft.organizerId, "organizer-1");
  assert.equal(result.draft.eventCategoryId, "category-1");
}

function testMissingCategoryDoesNotBlock() {
  const result = buildEventCreateDraft({ candidate: candidateFixture(), context: contextFixture() });
  assert.equal(result.ok, true, "eventCategoryId is nullable on Activity — an absent context value must never block the draft");
}

function testSourceTermsNeverInfluenceDraft() {
  const withTerms = buildEventCreateDraft({
    candidate: candidateFixture({
      sourceTerms: [{ termId: 1, taxonomy: "events-category", name: "Festival", slug: "festival" }],
    }),
    context: contextFixture(),
  });
  const withoutTerms = buildEventCreateDraft({
    candidate: candidateFixture({ sourceTerms: [] }),
    context: contextFixture(),
  });
  assert.deepEqual(withTerms, withoutTerms);
}

function testNoMediaFieldsEverAppearInDraft() {
  const result = buildEventCreateDraft({ candidate: candidateFixture(), context: contextFixture() });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const keys = Object.keys(result.draft);
  assert.ok(!keys.some((key) => /cover|image|media|gallery/i.test(key)));
}

function testPriceRawCopiedOnlyToPriceText() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({ priceRaw: "20-30 BYN" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.priceText, "20-30 BYN");

  const withNullPrice = buildEventCreateDraft({
    candidate: candidateFixture({ priceRaw: null }),
    context: contextFixture(),
  });
  assert.equal(withNullPrice.ok, true);
  if (!withNullPrice.ok) return;
  assert.equal(withNullPrice.draft.priceText, null);
}

function testTicketUrlNeverAppearsInDraft() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({ ticketUrlRaw: "https://tickets.example.com/kids-fest" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(!("ticketUrl" in result.draft));
  assert.ok(!("ticketUrlRaw" in result.draft));
  assert.ok(!("website" in result.draft));
}

function testDraftHasExactlyTheApprovedFieldSet() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture(),
    context: contextFixture({ cityId: "city-1", placeId: "place-1", organizerId: "organizer-1", eventCategoryId: "category-1" }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    new Set(Object.keys(result.draft)),
    new Set([
      "title",
      "shortDesc",
      "description",
      "type",
      "status",
      "ownerUserId",
      "cityId",
      "placeId",
      "organizerId",
      "eventCategoryId",
      "scheduleMode",
      "scheduleJson",
      "priceText",
      "venue",
    ]),
  );
}

function testVenueDraftManualWhenNoPlaceMatch() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({
      venueNameRaw: "Central Park",
      addressEventPlaceRaw: "ul. Central, 1",
      cityRaw: "Minsk",
    }),
    context: contextFixture({ cityId: "city-1" }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.draft.venue, {
    kind: "MANUAL",
    placeId: null,
    title: "Central Park",
    addressLine: "ul. Central, 1",
    cityId: "city-1",
    lat: null,
    lng: null,
    note: "Source city hint: Minsk",
    source: "wordpress-db",
  });
}

function testVenueDraftPlaceWhenMatched() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({
      venueNameRaw: "Central Park",
      addressEventPlaceRaw: "ul. Central, 1",
      location: { address: "ul. Central, 1", lat: 53.9, lng: 27.5 },
    }),
    context: contextFixture({ placeId: "place-9", cityId: "city-1" }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.draft.venue, {
    kind: "PLACE",
    placeId: "place-9",
    title: "Central Park",
    addressLine: "ul. Central, 1",
    cityId: "city-1",
    // A matched Place is the coordinate source of truth — never duplicated onto the venue row, even when parsed source coordinates exist.
    lat: null,
    lng: null,
    note: null,
    source: "wordpress-db",
  });
}

function testVenueDraftBlankAddressMetaFallsBackToParsedLocation() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({
      venueNameRaw: null,
      addressEventPlaceRaw: "",
      location: { address: "Минск, ул. Примерная, 10", lat: null, lng: null },
    }),
    context: contextFixture({ placeId: null }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.ok(result.draft.venue);
  assert.equal(result.draft.venue?.kind, "MANUAL");
  assert.equal(result.draft.venue?.placeId, null);
  assert.equal(result.draft.venue?.addressLine, "Минск, ул. Примерная, 10");
}

function testVenueDraftWhitespaceAddressMetaFallsBackToParsedLocation() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({
      venueNameRaw: null,
      addressEventPlaceRaw: "   ",
      location: { address: "Минск, ул. Примерная, 10", lat: null, lng: null },
    }),
    context: contextFixture({ placeId: null }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.venue?.addressLine, "Минск, ул. Примерная, 10");
}

function testVenueDraftAddressMetaTakesPriorityOverParsedLocationWhenBothPresent() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({
      venueNameRaw: null,
      addressEventPlaceRaw: "  ul. Central, 1  ",
      location: { address: "Минск, ул. Примерная, 10", lat: null, lng: null },
    }),
    context: contextFixture({ placeId: null }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.venue?.addressLine, "ul. Central, 1");
}

function testVenueDraftNullWhenNoEvidenceAtAll() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({ venueNameRaw: null, addressEventPlaceRaw: null, locationRaw: null, location: null }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.venue, null, "no matched Place and no venue/address hint at all -> no fallback row");
}

function testVenueDraftFallsBackToParsedLocationWhenAddressMissing() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({
      venueNameRaw: null,
      addressEventPlaceRaw: null,
      location: { address: "Minsk, Central Park", lat: null, lng: null },
    }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.venue?.kind, "MANUAL");
  assert.equal(result.draft.venue?.addressLine, "Minsk, Central Park");
}

function testVenueDraftNeverEmbedsRawJsonLocationString() {
  // The exact real-world shape from source 42041: no addressEventPlaceRaw,
  // locationRaw is a JSON-object string. buildVenueDraft() must consume the
  // already-parsed `candidate.location`, never `candidate.locationRaw`.
  const rawJson =
    '{"address":"улица Мясникова 44, Минск","map_picker":false,"latitude":53.89602,"longitude":27.53968}';
  const result = buildEventCreateDraft({
    candidate: candidateFixture({
      venueNameRaw: "Музыкальный театр",
      addressEventPlaceRaw: null,
      locationRaw: rawJson,
      location: { address: "улица Мясникова 44, Минск", lat: 53.89602, lng: 27.53968 },
    }),
    context: contextFixture({ placeId: null }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.draft.venue, {
    kind: "MANUAL",
    placeId: null,
    title: "Музыкальный театр",
    addressLine: "улица Мясникова 44, Минск",
    cityId: null,
    lat: 53.89602,
    lng: 27.53968,
    note: "Source city hint: Minsk",
    source: "wordpress-db",
  });
  assert.ok(!result.draft.venue?.addressLine?.startsWith("{"), "addressLine must never be the raw JSON blob");
}

function testVenueDraftCoordinatesNullWhenLocationHasNone() {
  const result = buildEventCreateDraft({
    candidate: candidateFixture({
      venueNameRaw: "Клуб приключений",
      addressEventPlaceRaw: null,
      location: { address: null, lat: null, lng: null },
    }),
    context: contextFixture({ placeId: null }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.draft.venue?.addressLine, null);
  assert.equal(result.draft.venue?.lat, null);
  assert.equal(result.draft.venue?.lng, null);
}

function testVenueDraftUnresolvedPlaceNeverBlocksDraft() {
  // No context.placeId (unresolved/low-confidence Place match) but venue evidence exists.
  const result = buildEventCreateDraft({
    candidate: candidateFixture({ venueNameRaw: "Some Venue" }),
    context: contextFixture(),
  });
  assert.equal(result.ok, true, "an unresolved Place match must never block Event creation");
}

function main() {
  testHappyPath();
  testMissingOwnerBlocked();
  testMissingTitleBlocked();
  testMissingShortDescBlocked();
  testMissingScheduleBlocked();
  testShortDescFallsBackToContent();
  testShortDescTruncatedWithEllipsis();
  testContextFieldsCopiedWhenProvided();
  testMissingCategoryDoesNotBlock();
  testSourceTermsNeverInfluenceDraft();
  testNoMediaFieldsEverAppearInDraft();
  testPriceRawCopiedOnlyToPriceText();
  testTicketUrlNeverAppearsInDraft();
  testDraftHasExactlyTheApprovedFieldSet();
  testVenueDraftManualWhenNoPlaceMatch();
  testVenueDraftPlaceWhenMatched();
  testVenueDraftBlankAddressMetaFallsBackToParsedLocation();
  testVenueDraftWhitespaceAddressMetaFallsBackToParsedLocation();
  testVenueDraftAddressMetaTakesPriorityOverParsedLocationWhenBothPresent();
  testVenueDraftNullWhenNoEvidenceAtAll();
  testVenueDraftFallsBackToParsedLocationWhenAddressMissing();
  testVenueDraftUnresolvedPlaceNeverBlocksDraft();
  testVenueDraftNeverEmbedsRawJsonLocationString();
  testVenueDraftCoordinatesNullWhenLocationHasNone();
}

main();
console.log("buildEventCreateDraft tests: OK");

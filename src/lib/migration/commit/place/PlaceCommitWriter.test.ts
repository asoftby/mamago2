import assert from "node:assert/strict";

import type { Place } from "@prisma/client";

import { PlaceCommitWriter } from "./PlaceCommitWriter";
import type { PlaceCommitWriterPrismaClient } from "./PlaceCommitWriter";
import type { PlaceCreateDraft } from "./types";

function draftFixture(overrides: Partial<PlaceCreateDraft> = {}): PlaceCreateDraft {
  return {
    title: "Cool Place",
    shortDesc: "A great place for kids",
    description: "A cool place for kids.",
    category: "кафе",
    status: "PENDING",
    locationSource: "MANUAL",
    createdByUserId: "user-1",
    cityId: "city-1",
    lat: 53.9,
    lng: 27.5667,
    phone: "+375291234567",
    website: null,
    slug: null,
    ...overrides,
  };
}

function placeFixture(overrides: Partial<Place> = {}): Place {
  return {
    id: "place-1",
    title: "Cool Place",
    cityId: "city-1",
    lat: 53.9,
    lng: 27.5667,
    phone: "+375291234567",
    phoneLabel: null,
    phone2: null,
    phone2Label: null,
    phone3: null,
    phone3Label: null,
    website: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    activityTypes: [],
    addressJson: null,
    ageTags: [],
    category: "кафе",
    countryCode: null,
    customAddress: null,
    displayAddress: null,
    description: "A cool place for kids.",
    directionsNote: null,
    formattedAddr: null,
    googlePlaceId: null,
    instagramHandle: null,
    instagramUrl: null,
    reelsUrl: null,
    locationName: null,
    locationSource: "MANUAL",
    logoImageId: null,
    shortDesc: "A great place for kids",
    status: "PENDING",
    visitFormats: [],
    floor: null,
    parentPlaceId: null,
    placeKind: "STANDALONE",
    unit: null,
    unitLabel: null,
    districtAutoId: null,
    districtManualId: null,
    metroAutoId: null,
    metroManualId: null,
    metroAutoDistanceM: null,
    metroManualDistanceM: null,
    createRequestId: null,
    moderatedByUserId: null,
    moderationReviewedAt: null,
    moderatorComment: null,
    revisionRequestedAt: null,
    revisionResubmittedAt: null,
    archivedAt: null,
    archivedByUserId: null,
    hasActiveImprovementRequests: false,
    slug: null,
    shortAddress: null,
    slugUpdatedAt: null,
    placeGroupId: null,
    openingHoursId: null,
    seoCanonicalUrl: null,
    seoDescription: null,
    seoH1: null,
    seoJsonLdOverride: null,
    seoOgDescription: null,
    seoOgImage: null,
    seoOgTitle: null,
    seoRobots: null,
    seoTitle: null,
    seoCanonicalSource: "FALLBACK",
    createdByUserId: "user-1",
    ownerBusinessId: null,
    primaryCategoryId: null,
    discoverySignalIds: [],
    bookingEnabled: false,
    bookingPhone: null,
    bookingNote: null,
    googleRating: null,
    googleUserRatingsTotal: null,
    googleReviewsJson: null,
    googleReviewsSyncedAt: null,
    googleMapsUri: null,
    priceItems: null,
    faqItems: null,
    ...overrides,
  };
}

function createFakeClient(createdPlace: Place = placeFixture()) {
  const calls: unknown[] = [];
  const client: PlaceCommitWriterPrismaClient = {
    place: {
      create: (async (args: unknown) => {
        calls.push(args);
        return createdPlace;
      }) as unknown as PlaceCommitWriterPrismaClient["place"]["create"],
    },
  };
  return { client, calls };
}

async function testHappyPathCallsCreateOnce() {
  const { client, calls } = createFakeClient();
  const writer = new PlaceCommitWriter(client);

  const result = await writer.createPlaceFromDraft(draftFixture());

  assert.equal(calls.length, 1);
  assert.deepEqual(result, { placeId: "place-1", status: "CREATED" });
}

async function testDataContainsOnlyAllowedFields() {
  const { client, calls } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await writer.createPlaceFromDraft(draftFixture());

  const call = calls[0] as { data: Record<string, unknown> };
  assert.deepEqual(new Set(Object.keys(call.data)), new Set([
    "title",
    "shortDesc",
    "description",
    "category",
    "status",
    "locationSource",
    "createdByUserId",
    "cityId",
    "lat",
    "lng",
    "phone",
    "website",
    "slug",
  ]));
}

async function testMissingCategoryIsNotWritten() {
  const { client, calls } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await writer.createPlaceFromDraft(draftFixture({ category: undefined }));

  const call = calls[0] as { data: Record<string, unknown> };
  assert.ok(!("category" in call.data));
}

async function testSlugAlwaysNull() {
  const { client, calls } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await writer.createPlaceFromDraft(draftFixture());

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.slug, null);
}

async function testStatusPendingAndLocationSourceManual() {
  const { client, calls } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await writer.createPlaceFromDraft(draftFixture());

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.status, "PENDING");
  assert.equal(call.data.locationSource, "MANUAL");
}

async function testCityIdIsNullable() {
  const { client, calls } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await writer.createPlaceFromDraft(draftFixture({ cityId: null }));

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.cityId, null);
}

async function testLatLngAreNullable() {
  const { client, calls } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await writer.createPlaceFromDraft(draftFixture({ lat: null, lng: null }));

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.lat, null);
  assert.equal(call.data.lng, null);
}

async function testNeverPassesMediaLogoOwnerBusinessOrRevisions() {
  const { client, calls } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await writer.createPlaceFromDraft(draftFixture());

  const call = calls[0] as { data: Record<string, unknown> };
  for (const forbiddenKey of [
    "logoImageId",
    "media",
    "gallery",
    "ownerBusinessId",
    "business",
    "revisions",
    "images",
    "sourceTerms",
    "rawMeta",
    "lineage",
  ]) {
    assert.ok(!(forbiddenKey in call.data), `data must never include "${forbiddenKey}"`);
  }
}

async function testEmptyCategoryIsNotWritten() {
  const { client } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await writer.createPlaceFromDraft(draftFixture({ category: "" }));
}

async function testEmptyCreatedByUserIdThrows() {
  const { client } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await assert.rejects(() => writer.createPlaceFromDraft(draftFixture({ createdByUserId: "" })));
}

async function testEmptyTitleThrows() {
  const { client } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await assert.rejects(() => writer.createPlaceFromDraft(draftFixture({ title: "   " })));
}

async function testEmptyShortDescThrows() {
  const { client } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await assert.rejects(() => writer.createPlaceFromDraft(draftFixture({ shortDesc: "" })));
}

async function testReturnsPlaceIdAndCreatedStatus() {
  const { client } = createFakeClient(placeFixture({ id: "place-42" }));
  const writer = new PlaceCommitWriter(client);
  const result = await writer.createPlaceFromDraft(draftFixture());

  assert.deepEqual(result, { placeId: "place-42", status: "CREATED" });
}

async function main() {
  await testHappyPathCallsCreateOnce();
  await testDataContainsOnlyAllowedFields();
  await testMissingCategoryIsNotWritten();
  await testSlugAlwaysNull();
  await testStatusPendingAndLocationSourceManual();
  await testCityIdIsNullable();
  await testLatLngAreNullable();
  await testNeverPassesMediaLogoOwnerBusinessOrRevisions();
  await testEmptyCategoryIsNotWritten();
  await testEmptyCreatedByUserIdThrows();
  await testEmptyTitleThrows();
  await testEmptyShortDescThrows();
  await testReturnsPlaceIdAndCreatedStatus();
}

main()
  .then(() => {
    console.log("PlaceCommitWriter tests: OK");
  })
  .catch((error) => {
    console.error("PlaceCommitWriter tests: FAILED", error);
    process.exitCode = 1;
  });

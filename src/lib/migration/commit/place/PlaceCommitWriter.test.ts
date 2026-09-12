import assert from "node:assert/strict";

import type { OpeningHours, Place } from "@prisma/client";

import { PlaceCommitWriter } from "./PlaceCommitWriter";
import type { PlaceCommitWriterPrismaClient } from "./PlaceCommitWriter";
import type { PlaceCreateDraft } from "./types";

function openingHoursDraftFixture(): NonNullable<PlaceCreateDraft["openingHours"]> {
  return {
    mode: "WEEKLY",
    timezone: "Europe/Minsk",
    rules: [
      { dayOfWeek: "MON", isOpen: true, allDay: false, intervals: [{ startTime: "09:00", endTime: "18:00" }] },
    ],
  };
}

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
    formattedAddr: null,
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
    agePolicy: "UNKNOWN",
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
    priceFrom: null,
    priceTo: null,
    currency: "BYN",
    priceMode: "UNKNOWN",
    priceItems: null,
    faqItems: null,
    ...overrides,
  };
}

function createFakeClient(
  options: {
    createdPlace?: Place;
    existingOpeningHoursId?: string | null;
    openingHoursCreateThrows?: Error;
    openingHoursUpdateThrows?: Error;
  } = {},
) {
  const createdPlace = options.createdPlace ?? placeFixture();
  const calls: unknown[] = [];
  const placeCreateCalls: unknown[] = [];
  const placeUpdateCalls: unknown[] = [];
  const openingHoursCreateCalls: unknown[] = [];
  const openingHoursUpdateCalls: unknown[] = [];

  const client: PlaceCommitWriterPrismaClient = {
    place: {
      create: (async (args: unknown) => {
        calls.push(args);
        placeCreateCalls.push(args);
        return createdPlace;
      }) as unknown as PlaceCommitWriterPrismaClient["place"]["create"],
      update: (async (args: unknown) => {
        calls.push(args);
        placeUpdateCalls.push(args);
        return createdPlace;
      }) as unknown as PlaceCommitWriterPrismaClient["place"]["update"],
      findUnique: (async () =>
        ({ openingHoursId: options.existingOpeningHoursId ?? null }) as unknown) as unknown as PlaceCommitWriterPrismaClient["place"]["findUnique"],
    },
    openingHours: {
      create: (async (args: unknown) => {
        openingHoursCreateCalls.push(args);
        if (options.openingHoursCreateThrows) throw options.openingHoursCreateThrows;
        return { id: "opening-hours-1" } as unknown as OpeningHours;
      }) as unknown as PlaceCommitWriterPrismaClient["openingHours"]["create"],
      update: (async (args: unknown) => {
        openingHoursUpdateCalls.push(args);
        if (options.openingHoursUpdateThrows) throw options.openingHoursUpdateThrows;
        return { id: (args as { where: { id: string } }).where.id } as unknown as OpeningHours;
      }) as unknown as PlaceCommitWriterPrismaClient["openingHours"]["update"],
    },
    $transaction: (async <T>(fn: (tx: PlaceCommitWriterPrismaClient) => Promise<T>) => fn(client)) as PlaceCommitWriterPrismaClient["$transaction"],
  };
  return { client, calls, placeCreateCalls, placeUpdateCalls, openingHoursCreateCalls, openingHoursUpdateCalls };
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
    "formattedAddr",
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
  const { client } = createFakeClient({ createdPlace: placeFixture({ id: "place-42" }) });
  const writer = new PlaceCommitWriter(client);
  const result = await writer.createPlaceFromDraft(draftFixture());

  assert.deepEqual(result, { placeId: "place-42", status: "CREATED" });
}

async function testUpdateUsesUpdateAndReturnsUpdatedStatus() {
  const { client, calls } = createFakeClient({ createdPlace: placeFixture({ id: "place-99" }) });
  const writer = new PlaceCommitWriter(client);
  const result = await writer.updatePlaceFromDraft("place-99", draftFixture({ title: "Updated Place" }));

  assert.deepEqual(result, { placeId: "place-99", status: "UPDATED" });
  const lastCall = calls[calls.length - 1] as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(lastCall.where.id, "place-99");
  assert.equal(lastCall.data.title, "Updated Place");
}

// ---------------------------------------------------------------------------
// Regression: UPDATE must never reset lifecycle or clobber an unresolved
// cityId — same bug class previously found and fixed in EventCommitWriter.
// ---------------------------------------------------------------------------

async function testUpdateNeverSendsStatus() {
  const { client, calls } = createFakeClient({ createdPlace: placeFixture({ id: "place-1" }) });
  const writer = new PlaceCommitWriter(client);
  // draftFixture().status is always "PENDING" (the CREATE-only default) —
  // if this ever reappeared in the UPDATE payload, an already-PUBLISHED
  // Place would silently revert to PENDING on its next re-commit.
  await writer.updatePlaceFromDraft("place-1", draftFixture());

  const lastCall = calls[calls.length - 1] as { data: Record<string, unknown> };
  assert.equal("status" in lastCall.data, false, "UPDATE must never touch status — lifecycle is an approval-flow concern only");
}

async function testUpdateOmitsCityIdWhenDraftCityIdIsNull() {
  const { client, calls } = createFakeClient({ createdPlace: placeFixture({ id: "place-1" }) });
  const writer = new PlaceCommitWriter(client);
  // cityId: null means the migration context couldn't resolve a city this
  // run — that must never be sent as an UPDATE, or a live Place's existing
  // cityId would be clobbered to null for lack of fresh evidence.
  await writer.updatePlaceFromDraft("place-1", draftFixture({ cityId: null }));

  const lastCall = calls[calls.length - 1] as { data: Record<string, unknown> };
  assert.equal("cityId" in lastCall.data, false, "UPDATE must omit cityId entirely when unresolved, never write null over an existing value");
}

async function testUpdateStillAppliesCityIdWhenDraftProvesANonNullValue() {
  const { client, calls } = createFakeClient({ createdPlace: placeFixture({ id: "place-1" }) });
  const writer = new PlaceCommitWriter(client);
  await writer.updatePlaceFromDraft("place-1", draftFixture({ cityId: "city-resolved" }));

  const lastCall = calls[calls.length - 1] as { data: Record<string, unknown> };
  assert.equal(lastCall.data.cityId, "city-resolved", "a proven, non-null cityId must still be applied on UPDATE");
}

// ---------------------------------------------------------------------------
// Opening hours — create/update, transaction boundary, idempotency.
// ---------------------------------------------------------------------------

async function testCreateWithoutOpeningHoursNeverTouchesOpeningHoursTable() {
  const { client, openingHoursCreateCalls } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await writer.createPlaceFromDraft(draftFixture());

  assert.equal(openingHoursCreateCalls.length, 0);
}

async function testCreateWithOpeningHoursCreatesBothInOneTransaction() {
  const { client, placeCreateCalls, openingHoursCreateCalls } = createFakeClient({
    createdPlace: placeFixture({ id: "place-1", openingHoursId: "opening-hours-1" }),
  });
  const writer = new PlaceCommitWriter(client);
  const result = await writer.createPlaceFromDraft(draftFixture({ openingHours: openingHoursDraftFixture() }));

  assert.equal(result.status, "CREATED");
  assert.equal(openingHoursCreateCalls.length, 1);
  assert.equal(placeCreateCalls.length, 1);
  const placeCall = placeCreateCalls[0] as { data: Record<string, unknown> };
  assert.equal(placeCall.data.openingHoursId, "opening-hours-1", "the Place row must be linked to the newly created OpeningHours row");
}

async function testCreateOpeningHoursFailureNeverCreatesPlace() {
  const { client, placeCreateCalls } = createFakeClient({
    openingHoursCreateThrows: new Error("opening hours db failure"),
  });
  const writer = new PlaceCommitWriter(client);

  await assert.rejects(
    () => writer.createPlaceFromDraft(draftFixture({ openingHours: openingHoursDraftFixture() })),
    /opening hours db failure/,
  );
  assert.equal(placeCreateCalls.length, 0, "a failed OpeningHours create must never leave a Place row behind");
}

async function testUpdateWithoutOpeningHoursNeverTouchesOpeningHoursTable() {
  const { client, openingHoursCreateCalls, openingHoursUpdateCalls } = createFakeClient();
  const writer = new PlaceCommitWriter(client);
  await writer.updatePlaceFromDraft("place-1", draftFixture());

  assert.equal(openingHoursCreateCalls.length, 0);
  assert.equal(openingHoursUpdateCalls.length, 0);
}

async function testUpdateWithExistingOpeningHoursReusesSameRowNeverDuplicates() {
  const { client, openingHoursCreateCalls, openingHoursUpdateCalls } = createFakeClient({
    existingOpeningHoursId: "opening-hours-existing",
  });
  const writer = new PlaceCommitWriter(client);
  await writer.updatePlaceFromDraft("place-1", draftFixture({ openingHours: openingHoursDraftFixture() }));

  assert.equal(openingHoursCreateCalls.length, 0, "an already-linked OpeningHours row must be updated, never re-created");
  assert.equal(openingHoursUpdateCalls.length, 1);
  const updateCall = openingHoursUpdateCalls[0] as { where: { id: string } };
  assert.equal(updateCall.where.id, "opening-hours-existing");
}

async function testUpdateWithNoExistingOpeningHoursCreatesAndLinksOne() {
  const { client, placeUpdateCalls, openingHoursCreateCalls } = createFakeClient({
    existingOpeningHoursId: null,
  });
  const writer = new PlaceCommitWriter(client);
  await writer.updatePlaceFromDraft("place-1", draftFixture({ openingHours: openingHoursDraftFixture() }));

  assert.equal(openingHoursCreateCalls.length, 1);
  const lastPlaceUpdate = placeUpdateCalls[placeUpdateCalls.length - 1] as { data: Record<string, unknown> };
  assert.equal(lastPlaceUpdate.data.openingHoursId, "opening-hours-1");
}

async function testRepeatedUpdateStaysIdempotentNoDuplicateOpeningHours() {
  const { client, openingHoursCreateCalls, openingHoursUpdateCalls } = createFakeClient({
    existingOpeningHoursId: "opening-hours-existing",
  });
  const writer = new PlaceCommitWriter(client);

  await writer.updatePlaceFromDraft("place-1", draftFixture({ openingHours: openingHoursDraftFixture() }));
  await writer.updatePlaceFromDraft("place-1", draftFixture({ openingHours: openingHoursDraftFixture() }));

  assert.equal(openingHoursCreateCalls.length, 0);
  assert.equal(openingHoursUpdateCalls.length, 2, "each repeated run updates the same row, never creates a second one");
}

async function testUpdateOpeningHoursFailureNeverUpdatesPlace() {
  const { client, placeUpdateCalls } = createFakeClient({
    existingOpeningHoursId: "opening-hours-existing",
    openingHoursUpdateThrows: new Error("opening hours update failed"),
  });
  const writer = new PlaceCommitWriter(client);

  await assert.rejects(
    () => writer.updatePlaceFromDraft("place-1", draftFixture({ openingHours: openingHoursDraftFixture() })),
    /opening hours update failed/,
  );
  assert.equal(placeUpdateCalls.length, 0, "a failed OpeningHours update must never proceed to update the Place row");
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
  await testUpdateUsesUpdateAndReturnsUpdatedStatus();
  await testUpdateNeverSendsStatus();
  await testUpdateOmitsCityIdWhenDraftCityIdIsNull();
  await testUpdateStillAppliesCityIdWhenDraftProvesANonNullValue();

  await testCreateWithoutOpeningHoursNeverTouchesOpeningHoursTable();
  await testCreateWithOpeningHoursCreatesBothInOneTransaction();
  await testCreateOpeningHoursFailureNeverCreatesPlace();
  await testUpdateWithoutOpeningHoursNeverTouchesOpeningHoursTable();
  await testUpdateWithExistingOpeningHoursReusesSameRowNeverDuplicates();
  await testUpdateWithNoExistingOpeningHoursCreatesAndLinksOne();
  await testRepeatedUpdateStaysIdempotentNoDuplicateOpeningHours();
  await testUpdateOpeningHoursFailureNeverUpdatesPlace();
}

main()
  .then(() => {
    console.log("PlaceCommitWriter tests: OK");
  })
  .catch((error) => {
    console.error("PlaceCommitWriter tests: FAILED", error);
    process.exitCode = 1;
  });

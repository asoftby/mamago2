import assert from "node:assert/strict";

import type { Activity } from "@prisma/client";

import { EventCommitWriter } from "./EventCommitWriter";
import type { EventCommitWriterPrismaClient } from "./EventCommitWriter";
import type { EventCreateDraft } from "./types";

function draftFixture(overrides: Partial<EventCreateDraft> = {}): EventCreateDraft {
  return {
    title: "Kids Fest",
    shortDesc: "A fun kids event",
    description: "<p>A fun kids event with games and music.</p>",
    type: "EVENT",
    status: "PENDING",
    ownerUserId: "user-1",
    cityId: "city-1",
    placeId: null,
    organizerId: null,
    eventCategoryId: null,
    scheduleMode: "ONE_TIME",
    scheduleJson: { mode: "ONE_TIME", dates: ["2026-08-15T10:00:00.000Z"] },
    priceText: "10 BYN",
    ...overrides,
  };
}

function activityFixture(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    description: "<p>A fun kids event with games and music.</p>",
    cityId: "city-1",
    metroStationId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ageMaxMonths: null,
    ageMinMonths: null,
    ageLabel: null,
    businessId: null,
    coverImageUrl: null,
    createdBy: null,
    currency: "BYN",
    priceFrom: null,
    ageTags: [],
    coverImageId: null,
    nextOccurrenceAt: null,
    ownerUserId: "user-1",
    placeId: null,
    priceText: "10 BYN",
    priceTo: null,
    scheduleJson: { mode: "ONE_TIME", dates: ["2026-08-15T10:00:00.000Z"] },
    scheduleMode: "ONE_TIME",
    shortDesc: "A fun kids event",
    status: "PENDING",
    title: "Kids Fest",
    type: "EVENT",
    format: "OFFLINE",
    priceDetails: null,
    eventCategoryId: null,
    genreSlugs: [],
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
    organizerId: null,
    priceItems: null,
    faqItems: null,
    phone: null,
    phoneLabel: null,
    phone2: null,
    phone2Label: null,
    phone3: null,
    phone3Label: null,
    bookingEnabled: false,
    bookingMode: null,
    bookingPhone: null,
    bookingNote: null,
    bookingCapacityPerSlot: null,
    slug: null,
    slugUpdatedAt: null,
    discoverySignalIds: [],
    ...overrides,
  } as Activity;
}

function createFakeClient(createdActivity: Activity = activityFixture()) {
  const calls: unknown[] = [];
  const client: EventCommitWriterPrismaClient = {
    activity: {
      create: (async (args: unknown) => {
        calls.push(args);
        return createdActivity;
      }) as unknown as EventCommitWriterPrismaClient["activity"]["create"],
    },
  };
  return { client, calls };
}

async function testHappyPathCallsCreateOnce() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);

  const result = await writer.createEventFromDraft(draftFixture());

  assert.equal(calls.length, 1);
  assert.deepEqual(result, { activityId: "activity-1", status: "CREATED" });
}

async function testDataContainsOnlyAllowedFields() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(draftFixture());

  const call = calls[0] as { data: Record<string, unknown> };
  assert.deepEqual(
    new Set(Object.keys(call.data)),
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
    ]),
  );
}

async function testTypeIsEvent() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(draftFixture());

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.type, "EVENT");
}

async function testStatusPending() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(draftFixture());

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.status, "PENDING");
}

async function testScheduleModeAndScheduleJsonPassedThrough() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(
    draftFixture({
      scheduleMode: "MULTI_DATE",
      scheduleJson: { mode: "MULTI_DATE", dates: ["2026-08-15T10:00:00.000Z", "2026-08-16T10:00:00.000Z"] },
    }),
  );

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.scheduleMode, "MULTI_DATE");
  assert.deepEqual(call.data.scheduleJson, {
    mode: "MULTI_DATE",
    dates: ["2026-08-15T10:00:00.000Z", "2026-08-16T10:00:00.000Z"],
  });
}

async function testOptionalContextFieldsPassedThroughAsIs() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(
    draftFixture({
      cityId: "city-9",
      placeId: "place-9",
      organizerId: "organizer-9",
      eventCategoryId: "category-9",
    }),
  );

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.cityId, "city-9");
  assert.equal(call.data.placeId, "place-9");
  assert.equal(call.data.organizerId, "organizer-9");
  assert.equal(call.data.eventCategoryId, "category-9");
}

async function testOptionalContextFieldsPassThroughNullUnchanged() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(
    draftFixture({ cityId: null, placeId: null, organizerId: null, eventCategoryId: null }),
  );

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.cityId, null);
  assert.equal(call.data.placeId, null);
  assert.equal(call.data.organizerId, null);
  assert.equal(call.data.eventCategoryId, null);
}

async function testNeverPassesSessionsVenueMediaOrMigrationFields() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(draftFixture());

  const call = calls[0] as { data: Record<string, unknown> };
  for (const forbiddenKey of [
    "sessions",
    "venue",
    "images",
    "coverImageId",
    "coverImageUrl",
    "media",
    "organizer",
    "sourceTerms",
    "rawMeta",
    "lineage",
    "migrationRecordId",
  ]) {
    assert.ok(!(forbiddenKey in call.data), `data must never include "${forbiddenKey}"`);
  }
}

async function testMissingTitleThrows() {
  const { client } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await assert.rejects(() => writer.createEventFromDraft(draftFixture({ title: "  " })));
}

async function testMissingShortDescThrows() {
  const { client } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await assert.rejects(() => writer.createEventFromDraft(draftFixture({ shortDesc: "" })));
}

async function testMissingOwnerUserIdThrows() {
  const { client } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await assert.rejects(() => writer.createEventFromDraft(draftFixture({ ownerUserId: "" })));
}

async function testMissingScheduleModeThrows() {
  const { client } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await assert.rejects(() =>
    writer.createEventFromDraft(draftFixture({ scheduleMode: undefined as unknown as "ONE_TIME" })),
  );
}

async function testWrongTypeThrows() {
  const { client } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await assert.rejects(() =>
    writer.createEventFromDraft(draftFixture({ type: "PERMANENT" as unknown as "EVENT" })),
  );
}

async function testReturnsActivityIdAndCreatedStatus() {
  const { client } = createFakeClient(activityFixture({ id: "activity-42" }));
  const writer = new EventCommitWriter(client);
  const result = await writer.createEventFromDraft(draftFixture());

  assert.deepEqual(result, { activityId: "activity-42", status: "CREATED" });
}

async function main() {
  await testHappyPathCallsCreateOnce();
  await testDataContainsOnlyAllowedFields();
  await testTypeIsEvent();
  await testStatusPending();
  await testScheduleModeAndScheduleJsonPassedThrough();
  await testOptionalContextFieldsPassedThroughAsIs();
  await testOptionalContextFieldsPassThroughNullUnchanged();
  await testNeverPassesSessionsVenueMediaOrMigrationFields();
  await testMissingTitleThrows();
  await testMissingShortDescThrows();
  await testMissingOwnerUserIdThrows();
  await testMissingScheduleModeThrows();
  await testWrongTypeThrows();
  await testReturnsActivityIdAndCreatedStatus();
}

main()
  .then(() => {
    console.log("EventCommitWriter tests: OK");
  })
  .catch((error) => {
    console.error("EventCommitWriter tests: FAILED", error);
    process.exitCode = 1;
  });

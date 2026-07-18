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
    scheduleJson: { mode: "ONE_TIME", dates: ["2026-08-15"] },
    priceText: "10 BYN",
    venue: null,
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
    scheduleJson: { mode: "ONE_TIME", dates: ["2026-08-15"] },
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

type FakeCall = {
  delegate: "activity" | "activitySession" | "eventVenue";
  method: string;
  args: unknown;
};

function createFakeClient(
  createdActivity: Activity = activityFixture(),
  nextUpcomingSession: { startsAt: Date } | null = { startsAt: new Date("2026-08-15T10:00:00.000Z") },
) {
  const calls: FakeCall[] = [];
  const client: EventCommitWriterPrismaClient = {
    activity: {
      create: (async (args: unknown) => {
        calls.push({ delegate: "activity", method: "create", args });
        return createdActivity;
      }) as unknown as EventCommitWriterPrismaClient["activity"]["create"],
      update: (async (args: unknown) => {
        calls.push({ delegate: "activity", method: "update", args });
        return createdActivity;
      }) as unknown as EventCommitWriterPrismaClient["activity"]["update"],
    },
    activitySession: {
      deleteMany: (async (args: unknown) => {
        calls.push({ delegate: "activitySession", method: "deleteMany", args });
        return { count: 0 };
      }) as unknown as EventCommitWriterPrismaClient["activitySession"]["deleteMany"],
      createMany: (async (args: unknown) => {
        calls.push({ delegate: "activitySession", method: "createMany", args });
        return { count: (args as { data?: unknown[] }).data?.length ?? 0 };
      }) as unknown as EventCommitWriterPrismaClient["activitySession"]["createMany"],
      findFirst: (async (args: unknown) => {
        calls.push({ delegate: "activitySession", method: "findFirst", args });
        return nextUpcomingSession;
      }) as unknown as EventCommitWriterPrismaClient["activitySession"]["findFirst"],
      findMany: (async (args: unknown) => {
        calls.push({ delegate: "activitySession", method: "findMany", args });
        return [];
      }) as unknown as EventCommitWriterPrismaClient["activitySession"]["findMany"],
    },
    eventVenue: {
      upsert: (async (args: unknown) => {
        calls.push({ delegate: "eventVenue", method: "upsert", args });
        return { id: "venue-1" };
      }) as unknown as EventCommitWriterPrismaClient["eventVenue"]["upsert"],
    },
  };
  return { client, calls };
}

function findCall(
  calls: FakeCall[],
  delegate: FakeCall["delegate"],
  method: string,
  predicate: (args: unknown) => boolean = () => true,
): FakeCall {
  const call = calls.find((candidate) =>
    candidate.delegate === delegate && candidate.method === method && predicate(candidate.args),
  );
  assert.ok(call, `Expected ${delegate}.${method} call`);
  return call;
}

function formatLocalDateTime(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function createManySessionLocalDateTimes(calls: FakeCall[]): string[] {
  const call = findCall(calls, "activitySession", "createMany");
  const data = (call.args as { data: Array<{ startsAt: Date }> }).data;
  return data.map((row) => formatLocalDateTime(row.startsAt));
}

function maybeCreateManySessionLocalDateTimes(calls: FakeCall[]): string[] {
  const call = calls.find((candidate) =>
    candidate.delegate === "activitySession" && candidate.method === "createMany",
  );
  if (!call) return [];
  const data = (call.args as { data: Array<{ startsAt: Date }> }).data;
  return data.map((row) => formatLocalDateTime(row.startsAt));
}

async function testHappyPathCallsCreateOnce() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);

  const result = await writer.createEventFromDraft(draftFixture());

  assert.equal(calls.filter((call) => call.delegate === "activity" && call.method === "create").length, 1);
  assert.deepEqual(result, { activityId: "activity-1", status: "CREATED" });
}

async function testDataContainsOnlyAllowedFields() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(draftFixture());

  const call = calls[0]?.args as { data: Record<string, unknown> };
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

  const call = calls[0]?.args as { data: Record<string, unknown> };
  assert.equal(call.data.type, "EVENT");
}

async function testStatusPending() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(draftFixture());

  const call = calls[0]?.args as { data: Record<string, unknown> };
  assert.equal(call.data.status, "PENDING");
}

async function testScheduleModeAndScheduleJsonPassedThrough() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(
    draftFixture({
      scheduleMode: "MULTI_DATE",
      scheduleJson: { mode: "MULTI_DATE", dates: ["2026-08-15", "2026-08-16"] },
    }),
  );

  const call = calls[0]?.args as { data: Record<string, unknown> };
  assert.equal(call.data.scheduleMode, "MULTI_DATE");
  assert.deepEqual(call.data.scheduleJson, {
    mode: "MULTI_DATE",
    dates: ["2026-08-15", "2026-08-16"],
  });
}

async function testCreateSyncsSingleDateSessionAndNextOccurrence() {
  const nextStartsAt = new Date("2026-08-15T10:00:00.000Z");
  const { client, calls } = createFakeClient(activityFixture(), { startsAt: nextStartsAt });
  const writer = new EventCommitWriter(client);

  await writer.createEventFromDraft(draftFixture({ scheduleJson: { mode: "ONE_TIME", dates: ["2026-08-15"] } }));

  assert.deepEqual(createManySessionLocalDateTimes(calls), ["2026-08-15T10:00"]);
  const nextOccurrenceCall = findCall(calls, "activity", "update", (args) =>
    (args as { data?: { nextOccurrenceAt?: Date } }).data?.nextOccurrenceAt === nextStartsAt,
  );
  assert.deepEqual(nextOccurrenceCall.args, {
    where: { id: "activity-1" },
    data: { nextOccurrenceAt: nextStartsAt },
  });
}

async function testCreateSyncsDateRangeSessions() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);

  await writer.createEventFromDraft(
    draftFixture({
      scheduleJson: {
        mode: "ONE_TIME",
        dates: ["2026-08-15", "2026-08-17"],
        scheduleItems: [{ date: "2026-08-15", dateEnd: "2026-08-17", startTime: "09:30" }],
        startTime: "09:30",
      },
    }),
  );

  assert.deepEqual(createManySessionLocalDateTimes(calls), [
    "2026-08-15T09:30",
    "2026-08-16T09:30",
    "2026-08-17T09:30",
  ]);
}

async function testCreateSyncsMultipleDates() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);

  await writer.createEventFromDraft(
    draftFixture({
      scheduleMode: "MULTI_DATE",
      scheduleJson: {
        mode: "MULTI_DATE",
        dates: ["2026-08-15", "2026-08-20"],
        startTime: "11:15",
      },
    }),
  );

  assert.deepEqual(createManySessionLocalDateTimes(calls), [
    "2026-08-15T11:15",
    "2026-08-20T11:15",
  ]);
}

async function testPastEventSyncsNullNextOccurrence() {
  const { client, calls } = createFakeClient(activityFixture(), null);
  const writer = new EventCommitWriter(client);

  await writer.createEventFromDraft(draftFixture({ scheduleJson: { mode: "ONE_TIME", dates: ["2020-01-01"] } }));

  findCall(calls, "activity", "update", (args) =>
    (args as { data?: { nextOccurrenceAt?: Date | null } }).data?.nextOccurrenceAt === null,
  );
}

async function testInvalidScheduleClearsSessionsAndNextOccurrence() {
  const { client, calls } = createFakeClient(activityFixture(), null);
  const writer = new EventCommitWriter(client);

  await writer.createEventFromDraft(
    draftFixture({
      scheduleJson: {
        mode: "ONE_TIME",
        dates: ["not-a-local-date"],
      },
    }),
  );

  assert.deepEqual(
    findCall(calls, "activitySession", "deleteMany").args,
    { where: { activityId: "activity-1" } },
  );
  assert.deepEqual(maybeCreateManySessionLocalDateTimes(calls), []);
  findCall(calls, "activity", "update", (args) =>
    (args as { data?: { nextOccurrenceAt?: Date | null } }).data?.nextOccurrenceAt === null,
  );
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

  const call = calls[0]?.args as { data: Record<string, unknown> };
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

  const call = calls[0]?.args as { data: Record<string, unknown> };
  assert.equal(call.data.cityId, null);
  assert.equal(call.data.placeId, null);
  assert.equal(call.data.organizerId, null);
  assert.equal(call.data.eventCategoryId, null);
}

async function testNeverPassesSessionsVenueMediaOrMigrationFields() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(draftFixture());

  const call = calls[0]?.args as { data: Record<string, unknown> };
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

async function testUpdateUsesUpdateAndReturnsUpdatedStatus() {
  const { client, calls } = createFakeClient(activityFixture({ id: "activity-99" }));
  const writer = new EventCommitWriter(client);
  const result = await writer.updateEventFromDraft("activity-99", draftFixture({ title: "Updated Event" }));

  assert.deepEqual(result, { activityId: "activity-99", status: "UPDATED" });
  const updateCall = findCall(calls, "activity", "update", (args) =>
    (args as { data?: { title?: string } }).data?.title === "Updated Event",
  ).args as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(updateCall.where.id, "activity-99");
  assert.equal(updateCall.data.title, "Updated Event");
}

async function testUpdateReplacesSessions() {
  const { client, calls } = createFakeClient(activityFixture({ id: "activity-99" }));
  const writer = new EventCommitWriter(client);

  await writer.updateEventFromDraft(
    "activity-99",
    draftFixture({
      scheduleJson: {
        mode: "MULTI_DATE",
        dates: ["2026-09-01", "2026-09-03"],
        startTime: "12:00",
      },
    }),
  );

  assert.deepEqual(
    findCall(calls, "activitySession", "deleteMany").args,
    { where: { activityId: "activity-99" } },
  );
  assert.deepEqual(createManySessionLocalDateTimes(calls), [
    "2026-09-01T12:00",
    "2026-09-03T12:00",
  ]);
}

async function testCreateWithNoVenueNeverCallsUpsert() {
  const { client, calls } = createFakeClient();
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(draftFixture({ venue: null }));

  assert.ok(!calls.some((call) => call.delegate === "eventVenue"));
}

async function testCreateWithManualVenueUpsertsByActivityId() {
  const { client, calls } = createFakeClient(activityFixture({ id: "activity-1" }));
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(
    draftFixture({
      venue: {
        kind: "MANUAL",
        placeId: null,
        title: "Central Park",
        addressLine: "ul. Central, 1",
        cityId: "city-1",
        lat: 53.89602,
        lng: 27.53968,
        note: "Source city hint: Minsk",
        source: "wordpress-db",
      },
    }),
  );

  const call = findCall(calls, "eventVenue", "upsert").args as {
    where: { activityId: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  };
  assert.equal(call.where.activityId, "activity-1");
  assert.equal(call.create.activityId, "activity-1");
  assert.equal(call.create.kind, "MANUAL");
  assert.equal(call.create.placeId, null);
  assert.equal(call.create.title, "Central Park");
  assert.equal(call.create.addressLine, "ul. Central, 1");
  assert.deepEqual(call.update, {
    kind: "MANUAL",
    placeId: null,
    title: "Central Park",
    addressLine: "ul. Central, 1",
    cityId: "city-1",
    lat: 53.89602,
    lng: 27.53968,
    note: "Source city hint: Minsk",
    source: "wordpress-db",
  });
}

async function testCreateWithPlaceVenueSetsKindPlace() {
  const { client, calls } = createFakeClient(activityFixture({ id: "activity-1" }));
  const writer = new EventCommitWriter(client);
  await writer.createEventFromDraft(
    draftFixture({
      venue: {
        kind: "PLACE",
        placeId: "place-9",
        title: "Central Park",
        addressLine: "ul. Central, 1",
        cityId: "city-1",
        lat: null,
        lng: null,
        note: null,
        source: "wordpress-db",
      },
    }),
  );

  const call = findCall(calls, "eventVenue", "upsert").args as { create: Record<string, unknown> };
  assert.equal(call.create.kind, "PLACE");
  assert.equal(call.create.placeId, "place-9");
  assert.equal(call.create.lat, null);
  assert.equal(call.create.lng, null);
}

async function testUpdateWithVenueUpsertsSameActivityId() {
  const { client, calls } = createFakeClient(activityFixture({ id: "activity-99" }));
  const writer = new EventCommitWriter(client);
  await writer.updateEventFromDraft(
    "activity-99",
    draftFixture({
      venue: {
        kind: "MANUAL",
        placeId: null,
        title: "Updated Venue",
        addressLine: null,
        cityId: null,
        lat: null,
        lng: null,
        note: null,
        source: "wordpress-db",
      },
    }),
  );

  const call = findCall(calls, "eventVenue", "upsert").args as { where: { activityId: string } };
  assert.equal(call.where.activityId, "activity-99");
}

async function main() {
  await testHappyPathCallsCreateOnce();
  await testDataContainsOnlyAllowedFields();
  await testTypeIsEvent();
  await testStatusPending();
  await testScheduleModeAndScheduleJsonPassedThrough();
  await testCreateSyncsSingleDateSessionAndNextOccurrence();
  await testCreateSyncsDateRangeSessions();
  await testCreateSyncsMultipleDates();
  await testPastEventSyncsNullNextOccurrence();
  await testInvalidScheduleClearsSessionsAndNextOccurrence();
  await testOptionalContextFieldsPassedThroughAsIs();
  await testOptionalContextFieldsPassThroughNullUnchanged();
  await testNeverPassesSessionsVenueMediaOrMigrationFields();
  await testMissingTitleThrows();
  await testMissingShortDescThrows();
  await testMissingOwnerUserIdThrows();
  await testMissingScheduleModeThrows();
  await testWrongTypeThrows();
  await testReturnsActivityIdAndCreatedStatus();
  await testUpdateUsesUpdateAndReturnsUpdatedStatus();
  await testUpdateReplacesSessions();
  await testCreateWithNoVenueNeverCallsUpsert();
  await testCreateWithManualVenueUpsertsByActivityId();
  await testCreateWithPlaceVenueSetsKindPlace();
  await testUpdateWithVenueUpsertsSameActivityId();
}

main()
  .then(() => {
    console.log("EventCommitWriter tests: OK");
  })
  .catch((error) => {
    console.error("EventCommitWriter tests: FAILED", error);
    process.exitCode = 1;
  });

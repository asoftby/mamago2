import assert from "node:assert/strict";

import type { Activity, MigrationLineage } from "@prisma/client";

import { runAtomicEventCreate } from "./runAtomicEventCreate";
import type { EventCreateTransactionClient, RunAtomicEventCreateInput } from "./runAtomicEventCreate";
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
    scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-15"] },
    venueNameRaw: "Central Park",
    locationRaw: "Minsk, Central Park",
    addressEventPlaceRaw: "ul. Central, 1",
    cityRaw: "Minsk",
    priceRaw: "10 BYN",
    ticketUrlRaw: null,
    externalEventId: null,
    externalLastUpdatedRaw: null,
    trailerUrlRaw: null,
    seo: { title: null, focusKeyword: null },
    sourceTerms: [],
    rawMeta: {},
    ...overrides,
  };
}

function contextFixture(overrides: Partial<EventCommitContext> = {}): EventCommitContext {
  return { ownerUserId: "user-1", cityId: "city-1", ...overrides };
}

function lineageInputFixture(
  overrides: Partial<RunAtomicEventCreateInput["lineageInput"]> = {},
): RunAtomicEventCreateInput["lineageInput"] {
  return {
    sourceId: "source-1",
    sourceEntityType: "wordpress-db:events",
    sourceStableKey: "wordpress-db:events:64251",
    sourceRecordKey: "wordpress-db:events:64251",
    targetType: "ACTIVITY",
    lastSourceHash: "hash-a",
    runId: "run-1",
    recordId: "record-1",
    ...overrides,
  };
}

function activityFixture(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    description: null,
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

function lineageFixture(overrides: Partial<MigrationLineage> = {}): MigrationLineage {
  return {
    id: "lineage-1",
    sourceId: "source-1",
    recordId: "record-1",
    runId: "run-1",
    sourceEntityType: "wordpress-db:events",
    sourceExternalId: null,
    sourceStableKey: "wordpress-db:events:64251",
    sourceRecordKey: "wordpress-db:events:64251",
    targetType: "ACTIVITY",
    targetId: "activity-1",
    targetRole: "primary",
    targetNaturalKey: null,
    lastSourceHash: "hash-a",
    lastPlanAction: null,
    isActive: true,
    firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSeenAt: null,
    lastImportedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

type FakeCall = { delegate: string; method: string; args: unknown };

function createFakeTx(options: {
  createActivityThrows?: Error;
  createLineageThrows?: Error;
  updateManyCount?: number;
  reactivatedLineage?: MigrationLineage;
} = {}) {
  const calls: FakeCall[] = [];
  const tx: EventCreateTransactionClient = {
    activity: {
      create: (async (args: unknown) => {
        calls.push({ delegate: "activity", method: "create", args });
        if (options.createActivityThrows) throw options.createActivityThrows;
        return activityFixture();
      }) as unknown as EventCreateTransactionClient["activity"]["create"],
      update: (async () => activityFixture()) as unknown as EventCreateTransactionClient["activity"]["update"],
    },
    activitySession: {
      createMany: (async (args: unknown) => {
        calls.push({ delegate: "activitySession", method: "createMany", args });
        return { count: (args as { data?: unknown[] }).data?.length ?? 0 };
      }) as unknown as EventCreateTransactionClient["activitySession"]["createMany"],
      deleteMany: (async (args: unknown) => {
        calls.push({ delegate: "activitySession", method: "deleteMany", args });
        return { count: 0 };
      }) as unknown as EventCreateTransactionClient["activitySession"]["deleteMany"],
      findFirst: (async () => ({ startsAt: new Date("2026-08-15T10:00:00.000Z") })) as unknown as EventCreateTransactionClient["activitySession"]["findFirst"],
      findMany: (async () => []) as unknown as EventCreateTransactionClient["activitySession"]["findMany"],
    },
    eventVenue: {
      upsert: (async (args: unknown) => {
        calls.push({ delegate: "eventVenue", method: "upsert", args });
        return { id: "venue-1" };
      }) as unknown as EventCreateTransactionClient["eventVenue"]["upsert"],
    },
    migrationLineage: {
      create: (async (args: unknown) => {
        calls.push({ delegate: "migrationLineage", method: "create", args });
        if (options.createLineageThrows) throw options.createLineageThrows;
        return lineageFixture();
      }) as unknown as EventCreateTransactionClient["migrationLineage"]["create"],
      updateMany: (async (args: unknown) => {
        calls.push({ delegate: "migrationLineage", method: "updateMany", args });
        return { count: options.updateManyCount ?? 0 };
      }) as unknown as EventCreateTransactionClient["migrationLineage"]["updateMany"],
      findUniqueOrThrow: (async (args: unknown) => {
        calls.push({ delegate: "migrationLineage", method: "findUniqueOrThrow", args });
        return options.reactivatedLineage ?? lineageFixture();
      }) as unknown as EventCreateTransactionClient["migrationLineage"]["findUniqueOrThrow"],
    },
  };
  return { tx, calls };
}

function uniqueConstraintError(): Error {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

async function testSuccessfulCreateWritesDomainAndFreshLineage() {
  const { tx, calls } = createFakeTx();
  const result = await runAtomicEventCreate(tx, {
    candidate: candidateFixture(),
    context: contextFixture(),
    lineageInput: lineageInputFixture(),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.activityId, "activity-1");
  assert.equal(result.lineageResult.lineageId, "lineage-1");
  const methods = calls.map((c) => `${c.delegate}.${c.method}`);
  assert.equal(methods[0], "activity.create", "the Activity row is always created first");
  assert.ok(methods.includes("eventVenue.upsert"), "venue must be synced (EventCommitWriter's own responsibility)");
  assert.equal(methods[methods.length - 1], "migrationLineage.create", "lineage is always written last, only after every domain row succeeded");
}

async function testDraftBlockedReturnsTypedResultWithoutAnyWrite() {
  const { tx, calls } = createFakeTx();
  const result = await runAtomicEventCreate(tx, {
    candidate: candidateFixture({ scheduleDraft: null }),
    context: contextFixture(),
    lineageInput: lineageInputFixture(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reasonCode, "EVENT_CREATE_BLOCKED");
  assert.ok(result.blockReasons.some((r) => r.code === "MISSING_SCHEDULE"));
  assert.equal(calls.length, 0, "a blocked draft must never touch the transaction client at all");
}

async function testWriterFailurePropagatesWithoutTouchingLineage() {
  const writerError = new Error("activity insert failed");
  const { tx, calls } = createFakeTx({ createActivityThrows: writerError });

  await assert.rejects(
    () => runAtomicEventCreate(tx, { candidate: candidateFixture(), context: contextFixture(), lineageInput: lineageInputFixture() }),
    (error: unknown) => error === writerError,
  );
  assert.ok(
    !calls.some((c) => c.delegate === "migrationLineage"),
    "lineage must never be attempted when the domain write itself failed",
  );
}

async function testLineageReactivatesInactiveRowOnConflict_64251Regression() {
  // The exact real-world shape: an authorized rollback deactivated the
  // historical lineage row for wordpress-db:events:64251, and a replay
  // commit must reactivate it rather than fail outright.
  const { tx, calls } = createFakeTx({
    createLineageThrows: uniqueConstraintError(),
    updateManyCount: 1,
    reactivatedLineage: lineageFixture({ id: "cmrqrgamh002kws21c93jy619", targetId: "activity-1" }),
  });

  const result = await runAtomicEventCreate(tx, {
    candidate: candidateFixture(),
    context: contextFixture(),
    lineageInput: lineageInputFixture({ sourceRecordKey: "wordpress-db:events:64251" }),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.lineageResult.lineageId, "cmrqrgamh002kws21c93jy619", "reactivates the same historical row, never a second one");
  assert.deepEqual(
    calls.filter((c) => c.delegate === "migrationLineage").map((c) => c.method),
    ["create", "updateMany", "findUniqueOrThrow"],
  );
}

async function testLineageActiveConflictPropagatesForTransactionRollback() {
  const { tx } = createFakeTx({ createLineageThrows: uniqueConstraintError(), updateManyCount: 0 });

  await assert.rejects(
    () => runAtomicEventCreate(tx, { candidate: candidateFixture(), context: contextFixture(), lineageInput: lineageInputFixture() }),
    /refusing to overwrite an active mapping/,
  );
}

async function testNowClockThreadedIntoLineageWriter() {
  const fixedNow = new Date("2026-07-19T00:00:00.000Z");
  const { tx, calls } = createFakeTx();
  await runAtomicEventCreate(tx, {
    candidate: candidateFixture(),
    context: contextFixture(),
    lineageInput: lineageInputFixture(),
    now: () => fixedNow,
  });

  const createCall = calls.find((c) => c.delegate === "migrationLineage" && c.method === "create")!;
  assert.equal((createCall.args as { data: { lastImportedAt: Date } }).data.lastImportedAt, fixedNow);
}

async function main() {
  await testSuccessfulCreateWritesDomainAndFreshLineage();
  await testDraftBlockedReturnsTypedResultWithoutAnyWrite();
  await testWriterFailurePropagatesWithoutTouchingLineage();
  await testLineageReactivatesInactiveRowOnConflict_64251Regression();
  await testLineageActiveConflictPropagatesForTransactionRollback();
  await testNowClockThreadedIntoLineageWriter();
}

main()
  .then(() => {
    console.log("runAtomicEventCreate tests: OK");
  })
  .catch((error) => {
    console.error("runAtomicEventCreate tests: FAILED", error);
    process.exitCode = 1;
  });

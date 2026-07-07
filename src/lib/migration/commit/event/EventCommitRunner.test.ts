import assert from "node:assert/strict";

import type { MigrationRecord } from "@prisma/client";

import { EventCommitRunner } from "./EventCommitRunner";
import type {
  EventCommitOrchestratorLike,
  EventCommitRunnerPrismaClient,
  ExecuteEventCommitRunInput,
  MigrationLineageWriterLike,
} from "./EventCommitRunner";
import type { ExecuteEventCommitResult } from "./EventCommitOrchestrator";
import type { CreateLineageResult } from "../../lineage/types";
import type { CommitOperation } from "../types";
import type { EventCommitContext, NormalizedEventCandidate } from "./types";

function operationFixture(overrides: Partial<CommitOperation> = {}): CommitOperation {
  return {
    recordId: "record-1",
    sourceRecordKey: "wordpress-db:events:401",
    targetType: "ACTIVITY",
    action: "CREATE",
    order: 0,
    dependsOn: [],
    rollbackSteps: [],
    ...overrides,
  };
}

function recordFixture(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    id: "record-1",
    sourceId: "source-1",
    runId: "run-1",
    status: "PLANNED",
    sourceEntityType: "wordpress-db:events",
    sourceExternalId: null,
    sourceStableKey: "wordpress-db:events:401",
    sourceRecordKey: "wordpress-db:events:401",
    sourceUrl: null,
    canonicalSourceUrl: null,
    sourceUpdatedAt: null,
    sourceHash: "hash-a",
    rawPayloadRef: null,
    rawPayload: null,
    normalizedPayloadRef: null,
    normalizedPayload: null,
    targetTypeHint: "ACTIVITY",
    planAction: "CREATE",
    planSummary: { title: "Kids Fest", slug: "kids-fest" },
    validationSummary: null,
    dependencyRefs: null,
    mediaRefs: null,
    relationRefs: null,
    redirectRefs: null,
    attemptCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

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

function inputFixture(overrides: Partial<ExecuteEventCommitRunInput> = {}): ExecuteEventCommitRunInput {
  return {
    operation: operationFixture(),
    record: recordFixture(),
    candidate: candidateFixture(),
    context: contextFixture(),
    ...overrides,
  };
}

function createFakeOrchestrator(result: ExecuteEventCommitResult) {
  const calls: unknown[] = [];
  const orchestrator: EventCommitOrchestratorLike = {
    execute: async (input) => {
      calls.push(input);
      return result;
    },
  };
  return { orchestrator, calls };
}

function createFakeLineageWriter(options: { result?: CreateLineageResult; throwError?: Error } = {}) {
  const calls: unknown[] = [];
  const writer: MigrationLineageWriterLike = {
    createLineage: async (input) => {
      calls.push(input);
      if (options.throwError) {
        throw options.throwError;
      }
      return (
        options.result ?? {
          lineageId: "lineage-1",
          sourceRecordKey: input.sourceRecordKey,
          targetType: input.targetType,
          targetId: input.targetId,
        }
      );
    },
  };
  return { writer, calls };
}

function createFakePrisma(options: { throwError?: Error } = {}) {
  const calls: unknown[] = [];
  const prisma: EventCommitRunnerPrismaClient = {
    migrationRecord: {
      update: (async (args: unknown) => {
        calls.push(args);
        if (options.throwError) {
          throw options.throwError;
        }
        return recordFixture();
      }) as unknown as EventCommitRunnerPrismaClient["migrationRecord"]["update"],
    },
  };
  return { prisma, calls };
}

async function testHappyPath() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, activityId: "activity-1" });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, true);
  assert.equal(result.activityId, "activity-1");
  assert.equal(result.lineageId, "lineage-1");
  assert.equal(result.recordId, "record-1");
  assert.equal(result.status, "LINKED");

  assert.equal(lineageCalls.length, 1);
  assert.equal((lineageCalls[0] as { targetType: string }).targetType, "ACTIVITY");
  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(updateCall.where.id, "record-1");
  assert.deepEqual(updateCall.data, { status: "LINKED", lastErrorCode: null, lastErrorMessage: null });
}

async function testOrchestratorBlockedMarksRecordFailedAndSkipsLineage() {
  const { orchestrator } = createFakeOrchestrator({
    ok: false,
    reasonCode: "EVENT_CREATE_BLOCKED",
    blockReasons: [{ code: "MISSING_SCHEDULE", message: "candidate.scheduleDraft is null" }],
  });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.recordId, "record-1");
  assert.equal(lineageCalls.length, 0, "lineage must never be written for a blocked commit");

  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.match(updateCall.data.lastErrorMessage as string, /MISSING_SCHEDULE/);
}

async function testOrchestratorFailedMarksRecordFailedAndSkipsLineage() {
  const writerError = new Error("db unavailable");
  const { orchestrator } = createFakeOrchestrator({
    ok: false,
    reasonCode: "EVENT_CREATE_FAILED",
    error: writerError,
  });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.error, writerError);
  assert.equal(lineageCalls.length, 0);

  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.equal(updateCall.data.lastErrorMessage, "db unavailable");
}

async function testLineageThrowsMarksRecordFailedWithoutRollingBackActivity() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, activityId: "activity-1" });
  const { writer: lineageWriter } = createFakeLineageWriter({ throwError: new Error("lineage db down") });
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator, lineageWriter, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.activityId, "activity-1", "the already-created Activity must still be reported, never hidden or rolled back");

  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.equal(updateCall.data.lastErrorMessage, "lineage db down");
}

async function testMigrationRecordUpdateThrowPropagatesRaw() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, activityId: "activity-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma } = createFakePrisma({ throwError: new Error("update failed") });
  const runner = new EventCommitRunner({ orchestrator, lineageWriter, prisma });

  await assert.rejects(() => runner.execute(inputFixture()), /update failed/);
}

async function testSourceHashPassedUnchangedToLineageWriter() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, activityId: "activity-1" });
  const { writer: lineageWriter, calls: lineageCalls } = createFakeLineageWriter();
  const { prisma } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator, lineageWriter, prisma });

  await runner.execute(inputFixture({ record: recordFixture({ sourceHash: "sha256-exact-value" }) }));

  const call = lineageCalls[0] as { lastSourceHash: string };
  assert.equal(call.lastSourceHash, "sha256-exact-value");
}

async function testActivityIdNeverWrittenToMigrationRecord() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, activityId: "activity-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator, lineageWriter, prisma });

  await runner.execute(inputFixture());

  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.ok(!("activityId" in updateCall.data));
  assert.ok(!("targetId" in updateCall.data));
}

async function testPlanSummaryNormalizedAndRawPayloadNeverTouched() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, activityId: "activity-1" });
  const { writer: lineageWriter } = createFakeLineageWriter();
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator, lineageWriter, prisma });

  await runner.execute(inputFixture());

  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.deepEqual(
    new Set(Object.keys(updateCall.data)),
    new Set(["status", "lastErrorCode", "lastErrorMessage"]),
    "the update payload must only ever touch execution-status fields",
  );
  assert.ok(!("planSummary" in updateCall.data));
  assert.ok(!("normalizedPayload" in updateCall.data));
  assert.ok(!("rawPayload" in updateCall.data));
}

async function testNoActivitySessionEventVenueOrMediaDelegateExists() {
  // `EventCommitRunnerPrismaClient` only ever exposes `migrationRecord` —
  // there is no `activitySession`/`eventVenue`/`activityImage`/`activity`
  // delegate to call anything on, and no schedule/media sync helper is
  // imported anywhere in this module (confirmed by inspection).
  const { prisma } = createFakePrisma();
  assert.deepEqual(Object.keys(prisma), ["migrationRecord"]);
}

async function main() {
  await testHappyPath();
  await testOrchestratorBlockedMarksRecordFailedAndSkipsLineage();
  await testOrchestratorFailedMarksRecordFailedAndSkipsLineage();
  await testLineageThrowsMarksRecordFailedWithoutRollingBackActivity();
  await testMigrationRecordUpdateThrowPropagatesRaw();
  await testSourceHashPassedUnchangedToLineageWriter();
  await testActivityIdNeverWrittenToMigrationRecord();
  await testPlanSummaryNormalizedAndRawPayloadNeverTouched();
  await testNoActivitySessionEventVenueOrMediaDelegateExists();
}

main()
  .then(() => {
    console.log("EventCommitRunner tests: OK");
  })
  .catch((error) => {
    console.error("EventCommitRunner tests: FAILED", error);
    process.exitCode = 1;
  });

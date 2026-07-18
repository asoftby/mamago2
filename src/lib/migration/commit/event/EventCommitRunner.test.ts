import assert from "node:assert/strict";

import type { MigrationLineage, MigrationRecord } from "@prisma/client";

import { EventCommitRunner } from "./EventCommitRunner";
import type {
  EventCommitOrchestratorLike,
  EventMediaSyncerLike,
  EventCommitRunnerPrismaClient,
  ExecuteEventCommitRunInput,
  RunAtomicEventCreateLike,
} from "./EventCommitRunner";
import type { EventCreateTransactionClient, RunAtomicEventCreateResult } from "./runAtomicEventCreate";
import type { ExecuteEventCommitResult } from "./EventCommitOrchestrator";
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

/** A no-op orchestrator — CREATE-path tests never call it, but the constructor still requires one. */
function unusedOrchestrator(): EventCommitOrchestratorLike {
  return {
    execute: async () => {
      throw new Error("orchestrator.execute() must never be called for a CREATE — that's runAtomicCreate's job now");
    },
  };
}

function createFakeRunAtomicCreate(
  result: RunAtomicEventCreateResult | { throwError: Error },
): { runAtomicCreate: RunAtomicEventCreateLike; calls: unknown[] } {
  const calls: unknown[] = [];
  const runAtomicCreate: RunAtomicEventCreateLike = async (_tx, input) => {
    calls.push(input);
    if ("throwError" in result) {
      throw result.throwError;
    }
    return result;
  };
  return { runAtomicCreate, calls };
}

/** A no-op atomic-create — UPDATE-path tests never call it, but the constructor still requires one. */
function unusedRunAtomicCreate(): RunAtomicEventCreateLike {
  return async () => {
    throw new Error("runAtomicCreate must never be called for an UPDATE");
  };
}

function createFakePrisma(options: { throwError?: Error; existingLineage?: MigrationLineage | null } = {}) {
  const calls: unknown[] = [];
  let transactionCallCount = 0;
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
    migrationLineage: {
      findFirst: (async () => options.existingLineage ?? null) as unknown as EventCommitRunnerPrismaClient["migrationLineage"]["findFirst"],
      update: (async (args: unknown) => {
        calls.push(args);
        const existing = options.existingLineage ?? {
          id: "lineage-1",
          sourceRecordKey: "wordpress-db:events:401",
          targetType: "ACTIVITY",
          targetId: "activity-1",
        };
        return existing as unknown as MigrationLineage;
      }) as unknown as EventCommitRunnerPrismaClient["migrationLineage"]["update"],
    },
    $transaction: async <T>(fn: (tx: EventCreateTransactionClient) => Promise<T>): Promise<T> => {
      transactionCallCount += 1;
      // The fake `tx` is never actually used by these tests — `runAtomicCreate`
      // is itself faked and ignores it — but the real signature must be honored.
      return fn({} as EventCreateTransactionClient);
    },
  };
  return { prisma, calls, transactionCallCount: () => transactionCallCount };
}

function createFakeMediaSyncer(warnings: Array<{ code: string; message: string }> = []) {
  const calls: unknown[] = [];
  const syncer: EventMediaSyncerLike = {
    sync: async (input) => {
      calls.push(input);
      return {
        warnings: warnings.map((warning) => ({
          ...warning,
          severity: "WARNING",
          sourceRecordKey: input.sourceRecordKey,
        })),
      };
    },
  };
  return { syncer, calls };
}

async function testCreateHappyPathRunsAtomicallyAndLinks() {
  const { runAtomicCreate, calls: atomicCalls } = createFakeRunAtomicCreate({
    ok: true,
    activityId: "activity-1",
    lineageResult: { lineageId: "lineage-1", sourceRecordKey: "wordpress-db:events:401", targetType: "ACTIVITY", targetId: "activity-1" },
  });
  const { prisma, calls: prismaCalls, transactionCallCount } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator: unusedOrchestrator(), runAtomicCreate, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, true);
  assert.equal(result.activityId, "activity-1");
  assert.equal(result.lineageId, "lineage-1");
  assert.equal(result.recordId, "record-1");
  assert.equal(result.status, "LINKED");

  assert.equal(transactionCallCount(), 1, "CREATE must go through exactly one $transaction call");
  assert.equal(atomicCalls.length, 1);
  assert.equal((atomicCalls[0] as { lineageInput: { targetType: string } }).lineageInput.targetType, "ACTIVITY");

  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(updateCall.where.id, "record-1");
  assert.deepEqual(updateCall.data, { status: "LINKED", lastErrorCode: null, lastErrorMessage: null });
}

async function testUpdateWithoutActiveLineageFailsAndNeverCallsOrchestrator() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, activityId: "activity-1" });
  const { prisma, calls: prismaCalls } = createFakePrisma({ existingLineage: null });
  const runner = new EventCommitRunner({ orchestrator, runAtomicCreate: unusedRunAtomicCreate(), prisma });

  const result = await runner.execute(inputFixture({ operation: operationFixture({ action: "UPDATE" }) }));

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.reasonCode, "EVENT_UPDATE_TARGET_MISSING");
  assert.equal(orchestratorCalls.length, 0, "orchestrator must never be called when UPDATE target is missing");

  assert.equal(prismaCalls.length, 1, "must update MigrationRecord to FAILED exactly once");
  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.equal(updateCall.data.lastErrorCode, "EVENT_UPDATE_TARGET_MISSING");
}

async function testUpdateWithActiveLineagePassesTargetActivityIdToOrchestrator() {
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, activityId: "activity-1" });
  const existingLineage = {
    id: "lineage-9",
    sourceRecordKey: "wordpress-db:events:401",
    targetType: "ACTIVITY",
    targetId: "activity-99",
  } as unknown as MigrationLineage;
  const { prisma } = createFakePrisma({ existingLineage });
  const runner = new EventCommitRunner({ orchestrator, runAtomicCreate: unusedRunAtomicCreate(), prisma });

  await runner.execute(inputFixture({ operation: operationFixture({ action: "UPDATE" }) }));

  assert.equal(orchestratorCalls.length, 1);
  const call = orchestratorCalls[0] as { targetActivityId?: string | null; operation: { action: string } };
  assert.equal(call.operation.action, "UPDATE");
  assert.equal(call.targetActivityId, "activity-99");
}

async function testUpdateNeverOpensATransaction() {
  const { orchestrator } = createFakeOrchestrator({ ok: true, activityId: "activity-1" });
  const existingLineage = { id: "lineage-9", sourceRecordKey: "wordpress-db:events:401", targetType: "ACTIVITY", targetId: "activity-99" } as unknown as MigrationLineage;
  const { prisma, transactionCallCount } = createFakePrisma({ existingLineage });
  const runner = new EventCommitRunner({ orchestrator, runAtomicCreate: unusedRunAtomicCreate(), prisma });

  await runner.execute(inputFixture({ operation: operationFixture({ action: "UPDATE" }) }));

  assert.equal(transactionCallCount(), 0, "UPDATE keeps its own non-transactional path — untouched by the CREATE atomicity fix");
}

async function testCreateDraftBlockedMarksRecordFailedNeverTouchesOrchestrator() {
  const { runAtomicCreate } = createFakeRunAtomicCreate({
    ok: false,
    reasonCode: "EVENT_CREATE_BLOCKED",
    blockReasons: [{ code: "MISSING_SCHEDULE", message: "candidate.scheduleDraft is null" }],
  });
  const { orchestrator, calls: orchestratorCalls } = createFakeOrchestrator({ ok: true, activityId: "activity-1" });
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator, runAtomicCreate, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.recordId, "record-1");
  assert.equal(orchestratorCalls.length, 0, "CREATE never touches the orchestrator at all anymore");

  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.match(updateCall.data.lastErrorMessage as string, /MISSING_SCHEDULE/);
}

async function testCreateTransactionThrowsMarksFailedAndNeverReportsAnActivityId() {
  // Simulates the exact bug this whole fix exists for: the lineage write
  // (or anything else inside the transaction) fails. Because
  // runAtomicCreate is invoked inside prisma.$transaction, a real Prisma
  // client would roll back everything — this fake demonstrates the
  // runner's own handling of that thrown error: FAILED, no activityId
  // ever surfaces, because as far as the runner can tell, nothing was
  // durably committed.
  const { runAtomicCreate } = createFakeRunAtomicCreate({ throwError: new Error("lineage db down") });
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator: unusedOrchestrator(), runAtomicCreate, prisma });

  const result = await runner.execute(inputFixture());

  assert.equal(result.ok, false);
  assert.equal(result.status, "FAILED");
  assert.equal(result.reasonCode, "EVENT_CREATE_TRANSACTION_FAILED");
  assert.equal(result.activityId, undefined, "no activityId is ever reported for a rolled-back transaction — nothing survived");

  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.equal(updateCall.data.lastErrorMessage, "lineage db down");
}

async function testMigrationRecordUpdateThrowPropagatesRaw() {
  const { runAtomicCreate } = createFakeRunAtomicCreate({
    ok: true,
    activityId: "activity-1",
    lineageResult: { lineageId: "lineage-1", sourceRecordKey: "wordpress-db:events:401", targetType: "ACTIVITY", targetId: "activity-1" },
  });
  const { prisma } = createFakePrisma({ throwError: new Error("update failed") });
  const runner = new EventCommitRunner({ orchestrator: unusedOrchestrator(), runAtomicCreate, prisma });

  await assert.rejects(() => runner.execute(inputFixture()), /update failed/);
}

async function testSourceHashPassedUnchangedIntoLineageInput() {
  const { runAtomicCreate, calls: atomicCalls } = createFakeRunAtomicCreate({
    ok: true,
    activityId: "activity-1",
    lineageResult: { lineageId: "lineage-1", sourceRecordKey: "wordpress-db:events:401", targetType: "ACTIVITY", targetId: "activity-1" },
  });
  const { prisma } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator: unusedOrchestrator(), runAtomicCreate, prisma });

  await runner.execute(inputFixture({ record: recordFixture({ sourceHash: "sha256-exact-value" }) }));

  const call = atomicCalls[0] as { lineageInput: { lastSourceHash: string } };
  assert.equal(call.lineageInput.lastSourceHash, "sha256-exact-value");
}

async function testActivityIdNeverWrittenToMigrationRecord() {
  const { runAtomicCreate } = createFakeRunAtomicCreate({
    ok: true,
    activityId: "activity-1",
    lineageResult: { lineageId: "lineage-1", sourceRecordKey: "wordpress-db:events:401", targetType: "ACTIVITY", targetId: "activity-1" },
  });
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator: unusedOrchestrator(), runAtomicCreate, prisma });

  await runner.execute(inputFixture());

  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.ok(!("activityId" in updateCall.data));
  assert.ok(!("targetId" in updateCall.data));
}

async function testMediaWarningsMergedIntoValidationSummary() {
  const { runAtomicCreate } = createFakeRunAtomicCreate({
    ok: true,
    activityId: "activity-1",
    lineageResult: { lineageId: "lineage-1", sourceRecordKey: "wordpress-db:events:401", targetType: "ACTIVITY", targetId: "activity-1" },
  });
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const { syncer, calls: mediaCalls } = createFakeMediaSyncer([
    { code: "EVENT_MEDIA_DOWNLOAD_FAILED", message: "download failed" },
  ]);
  const runner = new EventCommitRunner({ orchestrator: unusedOrchestrator(), runAtomicCreate, prisma, mediaSyncer: syncer });

  await runner.execute(
    inputFixture({
      record: recordFixture({
        validationSummary: [{ code: "EVENT_CITY_UNMATCHED", message: "city missing", severity: "WARNING" }],
      }),
    }),
  );

  assert.equal(mediaCalls.length, 1);
  assert.equal((mediaCalls[0] as { activityId: string }).activityId, "activity-1", "media sync uses the Activity created by the transaction");
  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  const validationSummary = updateCall.data.validationSummary as Array<{ code: string }>;
  assert.deepEqual(validationSummary.map((warning) => warning.code), [
    "EVENT_CITY_UNMATCHED",
    "EVENT_MEDIA_DOWNLOAD_FAILED",
  ]);
}

async function testMediaSyncNeverRunsWhenTransactionFails() {
  const { runAtomicCreate } = createFakeRunAtomicCreate({ throwError: new Error("lineage db down") });
  const { prisma } = createFakePrisma();
  const { syncer, calls: mediaCalls } = createFakeMediaSyncer();
  const runner = new EventCommitRunner({ orchestrator: unusedOrchestrator(), runAtomicCreate, prisma, mediaSyncer: syncer });

  await runner.execute(inputFixture());

  assert.equal(mediaCalls.length, 0, "media sync must never run for a rolled-back create — there is no Activity to attach media to");
}

async function testPlanSummaryNormalizedAndRawPayloadNeverTouched() {
  const { runAtomicCreate } = createFakeRunAtomicCreate({
    ok: true,
    activityId: "activity-1",
    lineageResult: { lineageId: "lineage-1", sourceRecordKey: "wordpress-db:events:401", targetType: "ACTIVITY", targetId: "activity-1" },
  });
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const runner = new EventCommitRunner({ orchestrator: unusedOrchestrator(), runAtomicCreate, prisma });

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

async function main() {
  await testCreateHappyPathRunsAtomicallyAndLinks();
  await testUpdateWithoutActiveLineageFailsAndNeverCallsOrchestrator();
  await testUpdateWithActiveLineagePassesTargetActivityIdToOrchestrator();
  await testUpdateNeverOpensATransaction();
  await testCreateDraftBlockedMarksRecordFailedNeverTouchesOrchestrator();
  await testCreateTransactionThrowsMarksFailedAndNeverReportsAnActivityId();
  await testMigrationRecordUpdateThrowPropagatesRaw();
  await testSourceHashPassedUnchangedIntoLineageInput();
  await testActivityIdNeverWrittenToMigrationRecord();
  await testMediaWarningsMergedIntoValidationSummary();
  await testMediaSyncNeverRunsWhenTransactionFails();
  await testPlanSummaryNormalizedAndRawPayloadNeverTouched();
}

main()
  .then(() => {
    console.log("EventCommitRunner tests: OK");
  })
  .catch((error) => {
    console.error("EventCommitRunner tests: FAILED", error);
    process.exitCode = 1;
  });

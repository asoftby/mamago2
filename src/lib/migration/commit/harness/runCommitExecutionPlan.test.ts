import assert from "node:assert/strict";

import type { MigrationRecord } from "@prisma/client";

import { runCommitExecutionPlan } from "./runCommitExecutionPlan";
import type { CommitRunWriterLike, RunCommitExecutionPlanInput, RunCommitExecutionPlanPrismaClient } from "./runCommitExecutionPlan";
import type { MigrationExecutionCandidate, MigrationRunExecutionPlan } from "../../core/orchestrator";
import type { MigrationPlan, MigrationPlanItem } from "../../types";
import type { PersistPlanInput, PersistPlanResult } from "../../writer/types";
import type { MigrationCommitContextConfig } from "../context/resolveCommitContextConfig";
import type { PlaceCommitRunnerLike } from "../dispatch/dispatchCommitRunner";

function planItemFixture(overrides: Partial<MigrationPlanItem> = {}): MigrationPlanItem {
  return {
    sourceRecordKey: "wordpress-db:places:301",
    sourceEntityType: "wordpress-db:places",
    action: "CREATE",
    status: "PLANNED",
    targetType: "PLACE",
    ...overrides,
  };
}

function executionCandidateFixture(
  overrides: Partial<MigrationExecutionCandidate> = {},
): MigrationExecutionCandidate {
  return {
    planItem: planItemFixture(),
    candidate: { title: "Cool Place" },
    ...overrides,
  };
}

function migrationPlanFixture(overrides: Partial<MigrationPlan> = {}): MigrationPlan {
  return {
    adapterKey: "wordpress-db",
    adapterVersion: "1.0.0",
    sourceNamespace: "test",
    mode: "DRY_RUN",
    createdAt: "2026-01-01T00:00:00.000Z",
    records: [],
    items: [planItemFixture()],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function migrationRecordFixture(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    id: "record-1",
    sourceId: "source-1",
    runId: "run-1",
    status: "PLANNED",
    sourceEntityType: "wordpress-db:places",
    sourceExternalId: null,
    sourceStableKey: "wordpress-db:places:301",
    sourceRecordKey: "wordpress-db:places:301",
    sourceUrl: null,
    canonicalSourceUrl: null,
    sourceUpdatedAt: null,
    sourceHash: "hash-a",
    rawPayloadRef: null,
    rawPayload: null,
    normalizedPayloadRef: null,
    normalizedPayload: null,
    targetTypeHint: "PLACE",
    planAction: "CREATE",
    planSummary: null,
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

function executionPlanFixture(overrides: Partial<MigrationRunExecutionPlan> = {}): MigrationRunExecutionPlan {
  return {
    plan: migrationPlanFixture(),
    executionCandidates: [executionCandidateFixture()],
    ...overrides,
  };
}

function createFakeRunWriter(records: readonly MigrationRecord[]) {
  const calls: PersistPlanInput[] = [];
  const runWriter: CommitRunWriterLike = {
    persistPlan: async (input) => {
      calls.push(input);
      const result: PersistPlanResult = {
        source: { id: "source-1" } as PersistPlanResult["source"],
        run: { id: "run-1" } as PersistPlanResult["run"],
        records,
      };
      return result;
    },
  };
  return { runWriter, calls };
}

function createFakePrisma() {
  const calls: unknown[] = [];
  const prisma: RunCommitExecutionPlanPrismaClient = {
    migrationRecord: {
      update: (async (args: unknown) => {
        calls.push(args);
        return migrationRecordFixture();
      }) as unknown as RunCommitExecutionPlanPrismaClient["migrationRecord"]["update"],
    },
  };
  return { prisma, calls };
}

function createFakePlaceRunner(ok: boolean, extra: Record<string, unknown> = {}) {
  const calls: unknown[] = [];
  const runner: PlaceCommitRunnerLike = {
    execute: async (input) => {
      calls.push(input);
      return ok
        ? { ok: true, placeId: "place-1", lineageId: "lineage-1", status: "LINKED", recordId: "record-1", ...extra }
        : { ok: false, status: "FAILED", recordId: "record-1", reasonCode: "PLACE_CREATE_FAILED", ...extra };
    },
  };
  return { runner, calls };
}

function baseInput(overrides: Partial<RunCommitExecutionPlanInput> = {}): RunCommitExecutionPlanInput {
  const { runWriter } = createFakeRunWriter([migrationRecordFixture()]);
  const { prisma } = createFakePrisma();
  return {
    executionPlan: executionPlanFixture(),
    contextConfig: { defaults: { place: { createdByUserId: "user-1" } } },
    runWriter,
    prisma,
    runners: {},
    ...overrides,
  };
}

async function testPersistPlanCalledBeforeDispatch() {
  const callOrder: string[] = [];
  const { runWriter } = createFakeRunWriter([migrationRecordFixture()]);
  const originalPersistPlan = runWriter.persistPlan.bind(runWriter);
  runWriter.persistPlan = async (input) => {
    callOrder.push("persistPlan");
    return originalPersistPlan(input);
  };
  const { runner: place } = createFakePlaceRunner(true);
  const wrappedPlace: PlaceCommitRunnerLike = {
    execute: async (input) => {
      callOrder.push("dispatch");
      return place.execute(input);
    },
  };

  await runCommitExecutionPlan(baseInput({ runWriter, runners: { place: wrappedPlace } }));

  assert.deepEqual(callOrder, ["persistPlan", "dispatch"]);
}

async function testPersistPlanCalledWithCommitMode() {
  const { runWriter, calls } = createFakeRunWriter([migrationRecordFixture()]);
  const { runner: place } = createFakePlaceRunner(true);

  await runCommitExecutionPlan(baseInput({ runWriter, runners: { place } }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, "COMMIT", "runCommitExecutionPlan must persist the plan as a COMMIT run, not DRY_RUN");
}

async function testRecordsMatchedBySourceRecordKey() {
  const { runWriter } = createFakeRunWriter([
    migrationRecordFixture({ id: "record-a", sourceRecordKey: "wordpress-db:places:301" }),
    migrationRecordFixture({ id: "record-b", sourceRecordKey: "wordpress-db:places:999" }),
  ]);
  const { runner: place, calls } = createFakePlaceRunner(true);

  await runCommitExecutionPlan(baseInput({ runWriter, runners: { place } }));

  const call = calls[0] as { record: MigrationRecord };
  assert.equal(call.record.id, "record-a", "the candidate for wordpress-db:places:301 must be matched to record-a, not record-b");
}

async function testContextResolverFailureMarksRecordFailedAndSkipsDispatch() {
  const { runWriter } = createFakeRunWriter([migrationRecordFixture()]);
  const { prisma, calls: prismaCalls } = createFakePrisma();
  const { runner: place, calls: placeCalls } = createFakePlaceRunner(true);

  const result = await runCommitExecutionPlan(
    baseInput({ runWriter, prisma, contextConfig: {}, runners: { place } }),
  );

  assert.equal(placeCalls.length, 0, "dispatch must never be reached when context resolution fails");
  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { data: Record<string, unknown> };
  assert.equal(updateCall.data.status, "FAILED");
  assert.equal(updateCall.data.lastErrorCode, "MISSING_REQUIRED_CONTEXT_FIELD");
  assert.equal(result.failed, 1);
  assert.equal(result.linked, 0);
}

async function testDispatchSuccessCountedLinked() {
  const { runner: place } = createFakePlaceRunner(true);
  const result = await runCommitExecutionPlan(baseInput({ runners: { place } }));

  assert.equal(result.linked, 1);
  assert.equal(result.failed, 0);
  assert.equal(result.results[0].outcome, "LINKED");
  assert.equal(result.results[0].targetId, "place-1");
}

async function testDispatchFailureCountedFailed() {
  const { runner: place } = createFakePlaceRunner(false);
  const result = await runCommitExecutionPlan(baseInput({ runners: { place } }));

  assert.equal(result.linked, 0);
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].outcome, "FAILED");
  assert.equal(result.results[0].errorCode, "PLACE_CREATE_FAILED");
}

async function testSkipUnchangedSkipsDispatch() {
  const { runner: place, calls } = createFakePlaceRunner(true);

  const result = await runCommitExecutionPlan(
    baseInput({
      executionPlan: executionPlanFixture({
        executionCandidates: [executionCandidateFixture({ planItem: planItemFixture({ action: "SKIP_UNCHANGED" }) })],
      }),
      runners: { place },
    }),
  );

  assert.equal(calls.length, 0, "dispatchCommitRunner must never be reached for a SKIP_UNCHANGED candidate");
  assert.equal(result.results[0].outcome, "SKIPPED");
}

async function testSkipUnchangedSkipsContextResolver() {
  // A context config with no place defaults at all would normally fail
  // resolution (MISSING_REQUIRED_CONTEXT_FIELD) — if the harness still
  // called the resolver for a SKIP_UNCHANGED candidate, this would show up
  // as a FAILED result instead of SKIPPED.
  const { runner: place, calls } = createFakePlaceRunner(true);

  const result = await runCommitExecutionPlan(
    baseInput({
      contextConfig: {},
      executionPlan: executionPlanFixture({
        executionCandidates: [executionCandidateFixture({ planItem: planItemFixture({ action: "SKIP_UNCHANGED" }) })],
      }),
      runners: { place },
    }),
  );

  assert.equal(calls.length, 0);
  assert.equal(result.results[0].outcome, "SKIPPED");
  assert.equal(result.failed, 0, "an empty contextConfig must never fail a SKIP_UNCHANGED candidate — the resolver is never consulted");
}

async function testSkipUnchangedMarksRecordLinked() {
  const { prisma, calls: prismaCalls } = createFakePrisma();

  await runCommitExecutionPlan(
    baseInput({
      prisma,
      executionPlan: executionPlanFixture({
        executionCandidates: [executionCandidateFixture({ planItem: planItemFixture({ action: "SKIP_UNCHANGED" }) })],
      }),
      runners: {},
    }),
  );

  assert.equal(prismaCalls.length, 1);
  const updateCall = prismaCalls[0] as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(updateCall.where.id, "record-1");
  assert.deepEqual(updateCall.data, { status: "LINKED", lastErrorCode: null, lastErrorMessage: null });
}

async function testSkippedCountIncrementsInSummary() {
  const result = await runCommitExecutionPlan(
    baseInput({
      executionPlan: executionPlanFixture({
        executionCandidates: [executionCandidateFixture({ planItem: planItemFixture({ action: "SKIP_UNCHANGED" }) })],
      }),
      runners: {},
    }),
  );

  assert.equal(result.total, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.linked, 0);
  assert.equal(result.failed, 0);
}

async function testCreateStillDispatches() {
  const { runner: place, calls } = createFakePlaceRunner(true);

  await runCommitExecutionPlan(
    baseInput({
      executionPlan: executionPlanFixture({
        executionCandidates: [executionCandidateFixture({ planItem: planItemFixture({ action: "CREATE" }) })],
      }),
      runners: { place },
    }),
  );

  assert.equal(calls.length, 1, "a CREATE candidate must still reach dispatchCommitRunner exactly as before PR32");
}

async function testUpdateStillDispatchesNotSkipped() {
  const { calls } = createFakePlaceRunner(true);
  const unsupportedActionRunner: PlaceCommitRunnerLike = {
    execute: async (input) => {
      calls.push(input);
      // Mirrors what the real PlaceCommitOrchestrator's existing
      // `action !== "CREATE"` guard actually returns — UPDATE is honestly
      // unsupported, not silently treated as a no-op.
      return { ok: false, status: "FAILED", recordId: "record-1", reasonCode: "UNSUPPORTED_OPERATION_ACTION" };
    },
  };

  const result = await runCommitExecutionPlan(
    baseInput({
      executionPlan: executionPlanFixture({
        executionCandidates: [executionCandidateFixture({ planItem: planItemFixture({ action: "UPDATE" }) })],
      }),
      runners: { place: unsupportedActionRunner },
    }),
  );

  assert.equal(calls.length, 1, "UPDATE must still be dispatched, not intercepted the way SKIP_UNCHANGED is");
  assert.equal(result.results[0].outcome, "FAILED");
  assert.equal(result.results[0].errorCode, "UNSUPPORTED_OPERATION_ACTION");
  assert.equal(result.skipped, 0);
}

async function testExactResultOrderPreservedWithMixedActions() {
  const { runWriter } = createFakeRunWriter([
    migrationRecordFixture({ id: "record-a", sourceRecordKey: "a" }),
    migrationRecordFixture({ id: "record-b", sourceRecordKey: "b" }),
    migrationRecordFixture({ id: "record-c", sourceRecordKey: "c" }),
  ]);
  const { runner: place } = createFakePlaceRunner(true);

  const executionPlan = executionPlanFixture({
    executionCandidates: [
      executionCandidateFixture({ planItem: planItemFixture({ sourceRecordKey: "a", action: "CREATE" }) }),
      executionCandidateFixture({ planItem: planItemFixture({ sourceRecordKey: "b", action: "SKIP_UNCHANGED" }) }),
      executionCandidateFixture({ planItem: planItemFixture({ sourceRecordKey: "c", action: "CREATE" }) }),
    ],
  });

  const result = await runCommitExecutionPlan(
    baseInput({ executionPlan, runWriter, runners: { place } }),
  );

  assert.deepEqual(
    result.results.map((r) => [r.sourceRecordKey, r.outcome]),
    [
      ["a", "LINKED"],
      ["b", "SKIPPED"],
      ["c", "LINKED"],
    ],
  );
}

async function testMigrationRecordUpdateThrowOnSkipPropagatesRaw() {
  const { prisma } = createFakePrisma();
  prisma.migrationRecord.update = (async () => {
    throw new Error("update failed on skip");
  }) as unknown as RunCommitExecutionPlanPrismaClient["migrationRecord"]["update"];

  await assert.rejects(
    () =>
      runCommitExecutionPlan(
        baseInput({
          prisma,
          executionPlan: executionPlanFixture({
            executionCandidates: [executionCandidateFixture({ planItem: planItemFixture({ action: "SKIP_UNCHANGED" }) })],
          }),
          runners: {},
        }),
      ),
    /update failed on skip/,
  );
}

async function testMissingMigrationRecordReturnsFailedResultSafely() {
  const { runWriter } = createFakeRunWriter([]); // persistPlan returns no records at all
  const { runner: place, calls } = createFakePlaceRunner(true);

  const result = await runCommitExecutionPlan(baseInput({ runWriter, runners: { place } }));

  assert.equal(calls.length, 0, "dispatch must never be reached without a persisted MigrationRecord");
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].errorCode, "MISSING_MIGRATION_RECORD");
  assert.equal(result.results[0].recordId, undefined, "there is no record id to report when none was found");
}

async function testExactSummaryCounts() {
  const { runWriter } = createFakeRunWriter([
    migrationRecordFixture({ id: "record-a", sourceRecordKey: "a" }),
    migrationRecordFixture({ id: "record-b", sourceRecordKey: "b" }),
    migrationRecordFixture({ id: "record-c", sourceRecordKey: "c" }),
  ]);
  const { runner: place } = createFakePlaceRunner(true);
  const { runner: failingPlace } = createFakePlaceRunner(false);

  const executionPlan = executionPlanFixture({
    executionCandidates: [
      executionCandidateFixture({ planItem: planItemFixture({ sourceRecordKey: "a" }) }),
      executionCandidateFixture({ planItem: planItemFixture({ sourceRecordKey: "b" }) }),
      executionCandidateFixture({ planItem: planItemFixture({ sourceRecordKey: "d" }) }), // no matching record
    ],
  });

  // First candidate succeeds, second fails, third has no record at all.
  let callCount = 0;
  const mixedRunner: PlaceCommitRunnerLike = {
    execute: async (input) => {
      callCount += 1;
      return callCount === 1 ? place.execute(input) : failingPlace.execute(input);
    },
  };

  const result = await runCommitExecutionPlan(
    baseInput({ executionPlan, runWriter, runners: { place: mixedRunner } }),
  );

  assert.equal(result.total, 3);
  assert.equal(result.linked, 1);
  assert.equal(result.failed, 2);
  assert.equal(result.results.length, 3);
}

async function testNoMutationOfExecutionPlanOrContextConfig() {
  const executionPlan = executionPlanFixture();
  const contextConfig: MigrationCommitContextConfig = { defaults: { place: { createdByUserId: "user-1" } } };
  const planSnapshot = JSON.parse(JSON.stringify(executionPlan));
  const configSnapshot = JSON.parse(JSON.stringify(contextConfig));
  const { runner: place } = createFakePlaceRunner(true);

  await runCommitExecutionPlan(baseInput({ executionPlan, contextConfig, runners: { place } }));

  assert.deepEqual(executionPlan, planSnapshot);
  assert.deepEqual(contextConfig, configSnapshot);
}

async function testMultipleCandidatesMixedResultOrderPreserved() {
  const { runWriter } = createFakeRunWriter([
    migrationRecordFixture({ id: "record-a", sourceRecordKey: "a" }),
    migrationRecordFixture({ id: "record-b", sourceRecordKey: "b" }),
    migrationRecordFixture({ id: "record-c", sourceRecordKey: "c" }),
  ]);
  const { runner: successRunner } = createFakePlaceRunner(true);
  const { runner: failRunner } = createFakePlaceRunner(false);

  let callCount = 0;
  const alternatingRunner: PlaceCommitRunnerLike = {
    execute: async (input) => {
      callCount += 1;
      // succeed, fail, succeed
      return callCount === 2 ? failRunner.execute(input) : successRunner.execute(input);
    },
  };

  const executionPlan = executionPlanFixture({
    executionCandidates: [
      executionCandidateFixture({ planItem: planItemFixture({ sourceRecordKey: "a" }) }),
      executionCandidateFixture({ planItem: planItemFixture({ sourceRecordKey: "b" }) }),
      executionCandidateFixture({ planItem: planItemFixture({ sourceRecordKey: "c" }) }),
    ],
  });

  const result = await runCommitExecutionPlan(
    baseInput({ executionPlan, runWriter, runners: { place: alternatingRunner } }),
  );

  assert.deepEqual(
    result.results.map((r) => [r.sourceRecordKey, r.outcome]),
    [
      ["a", "LINKED"],
      ["b", "FAILED"],
      ["c", "LINKED"],
    ],
  );
}

async function main() {
  await testPersistPlanCalledBeforeDispatch();
  await testPersistPlanCalledWithCommitMode();
  await testRecordsMatchedBySourceRecordKey();
  await testContextResolverFailureMarksRecordFailedAndSkipsDispatch();
  await testDispatchSuccessCountedLinked();
  await testDispatchFailureCountedFailed();
  await testSkipUnchangedSkipsDispatch();
  await testSkipUnchangedSkipsContextResolver();
  await testSkipUnchangedMarksRecordLinked();
  await testSkippedCountIncrementsInSummary();
  await testCreateStillDispatches();
  await testUpdateStillDispatchesNotSkipped();
  await testExactResultOrderPreservedWithMixedActions();
  await testMigrationRecordUpdateThrowOnSkipPropagatesRaw();
  await testMissingMigrationRecordReturnsFailedResultSafely();
  await testExactSummaryCounts();
  await testNoMutationOfExecutionPlanOrContextConfig();
  await testMultipleCandidatesMixedResultOrderPreserved();
}

main()
  .then(() => {
    console.log("runCommitExecutionPlan tests: OK");
  })
  .catch((error) => {
    console.error("runCommitExecutionPlan tests: FAILED", error);
    process.exitCode = 1;
  });

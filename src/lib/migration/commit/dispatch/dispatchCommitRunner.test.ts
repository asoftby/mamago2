import assert from "node:assert/strict";

import type { MigrationRecord } from "@prisma/client";

import { dispatchCommitRunner } from "./dispatchCommitRunner";
import type {
  ArticleCommitRunnerLike,
  DispatchCommitRunnerInput,
  EventCommitRunnerLike,
  PlaceCommitRunnerLike,
} from "./dispatchCommitRunner";
import type { MigrationExecutionCandidate } from "../../core/orchestrator";
import type { MigrationPlanItem } from "../../types";
import type { ExecutePlaceCommitRunInput, ExecutePlaceCommitRunResult } from "../place/PlaceCommitRunner";
import type { ExecuteEventCommitRunInput, ExecuteEventCommitRunResult } from "../event/EventCommitRunner";
import type { ExecuteArticleCommitRunInput, ExecuteArticleCommitRunResult } from "../article/ArticleCommitRunner";

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

function createFakePlaceRunner(result: ExecutePlaceCommitRunResult) {
  const calls: ExecutePlaceCommitRunInput[] = [];
  const runner: PlaceCommitRunnerLike = {
    execute: async (input) => {
      calls.push(input);
      return result;
    },
  };
  return { runner, calls };
}

function createFakeEventRunner(result: ExecuteEventCommitRunResult) {
  const calls: ExecuteEventCommitRunInput[] = [];
  const runner: EventCommitRunnerLike = {
    execute: async (input) => {
      calls.push(input);
      return result;
    },
  };
  return { runner, calls };
}

function createFakeArticleRunner(result: ExecuteArticleCommitRunResult) {
  const calls: ExecuteArticleCommitRunInput[] = [];
  const runner: ArticleCommitRunnerLike = {
    execute: async (input) => {
      calls.push(input);
      return result;
    },
  };
  return { runner, calls };
}

function baseInput(overrides: Partial<DispatchCommitRunnerInput> = {}): DispatchCommitRunnerInput {
  return {
    executionCandidate: executionCandidateFixture(),
    resolvedContext: { createdByUserId: "user-1" },
    migrationRecord: migrationRecordFixture(),
    runners: {},
    ...overrides,
  };
}

async function testDispatchPlaceCallsPlaceRunnerWithCorrectShape() {
  const { runner: place, calls } = createFakePlaceRunner({ ok: true, placeId: "place-1", status: "LINKED", recordId: "record-1" });
  const result = await dispatchCommitRunner(baseInput({ runners: { place } }));

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.operation.sourceRecordKey, "wordpress-db:places:301");
  assert.equal(call.operation.targetType, "PLACE");
  assert.equal(call.operation.action, "CREATE");
  assert.deepEqual(call.record, migrationRecordFixture());
  assert.deepEqual(call.candidate, { title: "Cool Place" });
  assert.deepEqual(call.context, { createdByUserId: "user-1" });
  assert.equal(result.ok, true);
}

async function testDispatchActivityCallsEventRunnerWithCorrectShape() {
  const { runner: event, calls } = createFakeEventRunner({ ok: true, activityId: "activity-1", status: "LINKED", recordId: "record-1" });
  const result = await dispatchCommitRunner(
    baseInput({
      executionCandidate: executionCandidateFixture({
        planItem: planItemFixture({ sourceRecordKey: "wordpress-db:events:401", targetType: "ACTIVITY" }),
        candidate: { title: "Kids Fest" },
      }),
      resolvedContext: { ownerUserId: "user-1" },
      runners: { event },
    }),
  );

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.operation.targetType, "ACTIVITY");
  assert.deepEqual(call.candidate, { title: "Kids Fest" });
  assert.deepEqual(call.context, { ownerUserId: "user-1" });
  assert.equal(result.ok, true);
}

async function testDispatchArticleCallsArticleRunnerWithCorrectShape() {
  const { runner: article, calls } = createFakeArticleRunner({ ok: true, articleId: "article-1", status: "LINKED", recordId: "record-1" });
  const result = await dispatchCommitRunner(
    baseInput({
      executionCandidate: executionCandidateFixture({
        planItem: planItemFixture({ sourceRecordKey: "wordpress-db:post:201", targetType: "ARTICLE" }),
        candidate: { title: "Hello Article" },
      }),
      resolvedContext: {},
      runners: { article },
    }),
  );

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.operation.targetType, "ARTICLE");
  assert.equal(call.operation.action, "CREATE");
  assert.deepEqual(call.candidate, { title: "Hello Article" });
  assert.deepEqual(call.context, {});
  assert.equal(call.migrationRecord.id, "record-1");
  assert.equal(result.ok, true);
}

async function testSuccessResultNormalizedToTargetId() {
  const { runner: place } = createFakePlaceRunner({ ok: true, placeId: "place-42", lineageId: "lineage-1", status: "LINKED", recordId: "record-1" });
  const result = await dispatchCommitRunner(baseInput({ runners: { place } }));

  assert.deepEqual(result, { ok: true, targetType: "PLACE", targetId: "place-42", lineageId: "lineage-1", status: "LINKED" });
}

async function testFailureResultNormalizedFromErrorObjectRunner() {
  const { runner: place } = createFakePlaceRunner({
    ok: false,
    status: "FAILED",
    recordId: "record-1",
    reasonCode: "PLACE_CREATE_FAILED",
    error: new Error("db unavailable"),
  });
  const result = await dispatchCommitRunner(baseInput({ runners: { place } }));

  assert.deepEqual(result, {
    ok: false,
    targetType: "PLACE",
    status: "FAILED",
    errorCode: "PLACE_CREATE_FAILED",
    errorMessage: "db unavailable",
  });
}

async function testFailureResultNormalizedFromArticleStringResult() {
  const { runner: article } = createFakeArticleRunner({
    ok: false,
    status: "FAILED",
    recordId: "record-1",
    errorCode: "ARTICLE_BLOCKED",
    errorMessage: "MISSING_TITLE: NormalizedArticleCandidate.title is empty.",
  });
  const result = await dispatchCommitRunner(
    baseInput({
      executionCandidate: executionCandidateFixture({
        planItem: planItemFixture({ sourceRecordKey: "wordpress-db:post:201", targetType: "ARTICLE" }),
      }),
      runners: { article },
    }),
  );

  assert.deepEqual(result, {
    ok: false,
    targetType: "ARTICLE",
    status: "FAILED",
    errorCode: "ARTICLE_BLOCKED",
    errorMessage: "MISSING_TITLE: NormalizedArticleCandidate.title is empty.",
  });
}

async function testUnknownTargetTypeReturnsUnknownTargetType() {
  const result = await dispatchCommitRunner(
    baseInput({
      executionCandidate: executionCandidateFixture({ planItem: planItemFixture({ targetType: "OFFER" }) }),
    }),
  );

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorCode, "UNKNOWN_TARGET_TYPE");
}

async function testMissingRunnerReturnsMissingCommitRunner() {
  const result = await dispatchCommitRunner(baseInput({ runners: {} }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.errorCode, "MISSING_COMMIT_RUNNER");
  assert.equal(result.targetType, "PLACE");
}

async function testDispatcherDoesNotMutateExecutionCandidateOrResolvedContext() {
  const { runner: place } = createFakePlaceRunner({ ok: true, placeId: "place-1", status: "LINKED", recordId: "record-1" });
  const executionCandidate = executionCandidateFixture();
  const resolvedContext = { createdByUserId: "user-1" };
  const candidateSnapshot = JSON.parse(JSON.stringify(executionCandidate));
  const contextSnapshot = JSON.parse(JSON.stringify(resolvedContext));

  await dispatchCommitRunner({
    executionCandidate,
    resolvedContext,
    migrationRecord: migrationRecordFixture(),
    runners: { place },
  });

  assert.deepEqual(executionCandidate, candidateSnapshot);
  assert.deepEqual(resolvedContext, contextSnapshot);
}

async function main() {
  await testDispatchPlaceCallsPlaceRunnerWithCorrectShape();
  await testDispatchActivityCallsEventRunnerWithCorrectShape();
  await testDispatchArticleCallsArticleRunnerWithCorrectShape();
  await testSuccessResultNormalizedToTargetId();
  await testFailureResultNormalizedFromErrorObjectRunner();
  await testFailureResultNormalizedFromArticleStringResult();
  await testUnknownTargetTypeReturnsUnknownTargetType();
  await testMissingRunnerReturnsMissingCommitRunner();
  await testDispatcherDoesNotMutateExecutionCandidateOrResolvedContext();
}

main()
  .then(() => {
    console.log("dispatchCommitRunner tests: OK");
  })
  .catch((error) => {
    console.error("dispatchCommitRunner tests: FAILED", error);
    process.exitCode = 1;
  });

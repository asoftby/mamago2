import assert from "node:assert/strict";

import type { MigrationRecord } from "@prisma/client";

import { buildCommitExecutionPlan } from "./buildCommitExecutionPlan";

let recordCounter = 0;
function recordFixture(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  recordCounter += 1;
  return {
    id: `record-${recordCounter}`,
    sourceId: "source-1",
    runId: "run-1",
    status: "PLANNED",
    sourceEntityType: "wordpress-db:post",
    sourceExternalId: null,
    sourceStableKey: `wordpress-db:post:${recordCounter}`,
    sourceRecordKey: `wordpress-db:post:${recordCounter}`,
    sourceUrl: null,
    canonicalSourceUrl: null,
    sourceUpdatedAt: null,
    sourceHash: null,
    rawPayloadRef: null,
    rawPayload: null,
    normalizedPayloadRef: null,
    normalizedPayload: null,
    targetTypeHint: "ARTICLE",
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

function testEmptyRecordsProducesEmptyPlan() {
  const plan = buildCommitExecutionPlan([], { supportedTargetTypes: ["ARTICLE", "PLACE"] });

  assert.deepEqual(plan.operations, []);
  assert.deepEqual(plan.blocked, []);
  assert.deepEqual(plan.unsupported, []);
  assert.deepEqual(plan.skipped, []);
  assert.deepEqual(plan.rollbackPlan, []);
  assert.deepEqual(plan.summary, {
    totalRecords: 0,
    operationCount: 0,
    blockedCount: 0,
    unsupportedCount: 0,
    skippedCount: 0,
    createCount: 0,
    updateCount: 0,
    byTargetType: {},
    byReasonCode: {},
  });
}

function testFailedStatusBlocksRegardlessOfAction() {
  const record = recordFixture({ status: "FAILED", planAction: "SKIP_UNCHANGED", targetTypeHint: "ARTICLE" });
  const plan = buildCommitExecutionPlan([record], { supportedTargetTypes: ["ARTICLE"] });

  assert.equal(plan.operations.length, 0);
  assert.equal(plan.skipped.length, 0, "a FAILED-status record must never land in skipped, even with a NOOP planAction");
  assert.equal(plan.blocked.length, 1);
  assert.equal(plan.blocked[0].reasonCode, "SOURCE_RECORD_FAILED");
  assert.equal(plan.blocked[0].recordId, record.id);
}

function testMissingTargetTypeBlocks() {
  const record = recordFixture({ targetTypeHint: null, planAction: "CREATE" });
  const plan = buildCommitExecutionPlan([record], { supportedTargetTypes: ["ARTICLE"] });

  assert.equal(plan.operations.length, 0);
  assert.equal(plan.blocked.length, 1);
  assert.equal(plan.blocked[0].reasonCode, "MISSING_TARGET_TYPE");
}

function testUnsupportedTargetType() {
  const record = recordFixture({ targetTypeHint: "MEDIA_ASSET", planAction: "CREATE" });
  const plan = buildCommitExecutionPlan([record], { supportedTargetTypes: ["ARTICLE", "PLACE"] });

  assert.equal(plan.operations.length, 0);
  assert.equal(plan.unsupported.length, 1);
  assert.equal(plan.unsupported[0].reasonCode, "TARGET_TYPE_UNSUPPORTED");
  assert.equal(plan.unsupported[0].targetType, "MEDIA_ASSET");
}

function testSkipUnchangedAndSkipPolicyAreSkipped() {
  const skipUnchanged = recordFixture({ planAction: "SKIP_UNCHANGED", targetTypeHint: "ARTICLE" });
  const skipPolicy = recordFixture({ planAction: "SKIP_POLICY", targetTypeHint: "ARTICLE" });
  const plan = buildCommitExecutionPlan([skipUnchanged, skipPolicy], { supportedTargetTypes: ["ARTICLE"] });

  assert.equal(plan.operations.length, 0);
  assert.equal(plan.skipped.length, 2);
  assert.ok(plan.skipped.every((item) => item.reasonCode === "NOOP_PLAN_ACTION"));
  assert.deepEqual(
    plan.skipped.map((item) => item.planAction),
    ["SKIP_UNCHANGED", "SKIP_POLICY"],
  );
}

function testCreateAndUpdateSupportedBecomeOperations() {
  const createRecord = recordFixture({ planAction: "CREATE", targetTypeHint: "ARTICLE" });
  const updateRecord = recordFixture({ planAction: "UPDATE", targetTypeHint: "PLACE" });
  const plan = buildCommitExecutionPlan([createRecord, updateRecord], {
    supportedTargetTypes: ["ARTICLE", "PLACE"],
  });

  assert.equal(plan.operations.length, 2);
  assert.equal(plan.blocked.length, 0);
  assert.equal(plan.unsupported.length, 0);
  assert.equal(plan.skipped.length, 0);
  assert.ok(plan.operations.some((op) => op.recordId === createRecord.id && op.action === "CREATE"));
  assert.ok(plan.operations.some((op) => op.recordId === updateRecord.id && op.action === "UPDATE"));
}

function testFailActionWithNonFailedStatusIsBlockedNotSkipped() {
  const record = recordFixture({ status: "PLANNED", planAction: "FAIL", targetTypeHint: "ARTICLE" });
  const plan = buildCommitExecutionPlan([record], { supportedTargetTypes: ["ARTICLE"] });

  assert.equal(plan.operations.length, 0);
  assert.equal(plan.skipped.length, 0, "FAIL planAction must never be treated as a NOOP skip");
  assert.equal(plan.blocked.length, 1);
  assert.equal(plan.blocked[0].reasonCode, "PLAN_ACTION_NOT_COMMITTABLE");
}

function testOrderingArticleBeforePlaceAndStableWithinType() {
  const place1 = recordFixture({ targetTypeHint: "PLACE", planAction: "CREATE" });
  const article1 = recordFixture({ targetTypeHint: "ARTICLE", planAction: "CREATE" });
  const place2 = recordFixture({ targetTypeHint: "PLACE", planAction: "UPDATE" });
  const article2 = recordFixture({ targetTypeHint: "ARTICLE", planAction: "UPDATE" });

  // Deliberately out-of-order input: place, article, place, article.
  const plan = buildCommitExecutionPlan([place1, article1, place2, article2], {
    supportedTargetTypes: ["ARTICLE", "PLACE"],
  });

  assert.deepEqual(
    plan.operations.map((op) => op.recordId),
    [article1.id, article2.id, place1.id, place2.id],
  );
  assert.deepEqual(
    plan.operations.map((op) => op.order),
    [0, 1, 2, 3],
  );
}

function testRollbackPlaceholdersForCreateAndUpdate() {
  const createRecord = recordFixture({ planAction: "CREATE", targetTypeHint: "ARTICLE" });
  const updateRecord = recordFixture({ planAction: "UPDATE", targetTypeHint: "ARTICLE" });
  const plan = buildCommitExecutionPlan([createRecord, updateRecord], { supportedTargetTypes: ["ARTICLE"] });

  const createOp = plan.operations.find((op) => op.recordId === createRecord.id)!;
  const updateOp = plan.operations.find((op) => op.recordId === updateRecord.id)!;

  assert.deepEqual(createOp.rollbackSteps, [
    { kind: "DELETE_CREATED_TARGET", recordId: createRecord.id, sourceRecordKey: createRecord.sourceRecordKey, targetId: null },
  ]);
  assert.deepEqual(updateOp.rollbackSteps, [
    {
      kind: "RESTORE_PREVIOUS_TARGET_STATE",
      recordId: updateRecord.id,
      sourceRecordKey: updateRecord.sourceRecordKey,
      targetId: null,
    },
  ]);

  // rollbackPlan is the flattened, reverse-of-execution-order undo sequence.
  assert.deepEqual(
    plan.rollbackPlan.map((step) => step.recordId),
    [updateRecord.id, createRecord.id],
  );
}

function testSummaryCounts() {
  const records = [
    recordFixture({ status: "FAILED", planAction: "CREATE", targetTypeHint: "ARTICLE" }), // blocked
    recordFixture({ targetTypeHint: null, planAction: "CREATE" }), // blocked
    recordFixture({ targetTypeHint: "MEDIA_ASSET", planAction: "CREATE" }), // unsupported
    recordFixture({ planAction: "SKIP_UNCHANGED", targetTypeHint: "ARTICLE" }), // skipped
    recordFixture({ planAction: "CREATE", targetTypeHint: "ARTICLE" }), // operation
    recordFixture({ planAction: "UPDATE", targetTypeHint: "PLACE" }), // operation
  ];

  const plan = buildCommitExecutionPlan(records, { supportedTargetTypes: ["ARTICLE", "PLACE"] });

  assert.deepEqual(plan.summary, {
    totalRecords: 6,
    operationCount: 2,
    blockedCount: 2,
    unsupportedCount: 1,
    skippedCount: 1,
    createCount: 1,
    updateCount: 1,
    byTargetType: { ARTICLE: 1, PLACE: 1 },
    byReasonCode: {
      SOURCE_RECORD_FAILED: 1,
      MISSING_TARGET_TYPE: 1,
      TARGET_TYPE_UNSUPPORTED: 1,
      NOOP_PLAN_ACTION: 1,
    },
  });
}

function testEmptySupportedTargetTypesMakesEverythingUnsupported() {
  const article = recordFixture({ planAction: "CREATE", targetTypeHint: "ARTICLE" });
  const place = recordFixture({ planAction: "UPDATE", targetTypeHint: "PLACE" });
  const plan = buildCommitExecutionPlan([article, place], { supportedTargetTypes: [] });

  assert.equal(plan.operations.length, 0, "no hardcoded fallback list — an empty supportedTargetTypes commits nothing");
  assert.equal(plan.unsupported.length, 2);
  assert.ok(plan.unsupported.every((item) => item.reasonCode === "TARGET_TYPE_UNSUPPORTED"));
}

function main() {
  testEmptyRecordsProducesEmptyPlan();
  testFailedStatusBlocksRegardlessOfAction();
  testMissingTargetTypeBlocks();
  testUnsupportedTargetType();
  testSkipUnchangedAndSkipPolicyAreSkipped();
  testCreateAndUpdateSupportedBecomeOperations();
  testFailActionWithNonFailedStatusIsBlockedNotSkipped();
  testOrderingArticleBeforePlaceAndStableWithinType();
  testRollbackPlaceholdersForCreateAndUpdate();
  testSummaryCounts();
  testEmptySupportedTargetTypesMakesEverythingUnsupported();
}

main();
console.log("buildCommitExecutionPlan tests: OK");

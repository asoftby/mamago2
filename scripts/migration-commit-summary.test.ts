import assert from "node:assert/strict";

import {
  formatCommitResultDetail,
  formatCommitResultLine,
} from "./migration-commit-summary";

function testFormatCommitResultDetailForFailedWithCodeAndMessage() {
  assert.equal(
    formatCommitResultDetail({
      outcome: "FAILED",
      errorCode: "MISSING_CREATED_BY_USER",
      errorMessage: "place.createdByUserId is required.",
    }),
    " — MISSING_CREATED_BY_USER: place.createdByUserId is required.",
  );
}

function testFormatCommitResultDetailForFailedWithMessageOnly() {
  assert.equal(
    formatCommitResultDetail({
      outcome: "FAILED",
      errorMessage: "persistPlan() did not return a MigrationRecord.",
    }),
    " — persistPlan() did not return a MigrationRecord.",
  );
}

function testFormatCommitResultDetailForFailedWithCodeOnly() {
  assert.equal(
    formatCommitResultDetail({
      outcome: "FAILED",
      errorCode: "UNSUPPORTED_OPERATION_ACTION",
    }),
    " — UNSUPPORTED_OPERATION_ACTION",
  );
}

function testFormatCommitResultDetailIgnoresNonFailedOutcomes() {
  assert.equal(
    formatCommitResultDetail({
      outcome: "SKIPPED",
      errorCode: "SHOULD_NOT_SHOW",
      errorMessage: "should not show",
    }),
    "",
  );
}

function testFormatCommitResultLineIncludesFailedDetail() {
  assert.equal(
    formatCommitResultLine({
      sourceRecordKey: "wordpress-db:places:437",
      outcome: "FAILED",
      errorCode: "MISSING_MIGRATION_RECORD",
      errorMessage: 'persistPlan() did not return a MigrationRecord for sourceRecordKey "wordpress-db:places:437".',
    }),
    '- wordpress-db:places:437: FAILED — MISSING_MIGRATION_RECORD: persistPlan() did not return a MigrationRecord for sourceRecordKey "wordpress-db:places:437".',
  );
}

function testFormatCommitResultLineIncludesTargetAndLineageWhenRequested() {
  assert.equal(
    formatCommitResultLine(
      {
        sourceRecordKey: "wordpress-db:places:437",
        outcome: "LINKED",
        targetId: "place-1",
        lineageId: "lineage-1",
      },
      { targetId: true, lineageId: true },
    ),
    "- wordpress-db:places:437: LINKED targetId=place-1 lineageId=lineage-1",
  );
}

function main() {
  testFormatCommitResultDetailForFailedWithCodeAndMessage();
  testFormatCommitResultDetailForFailedWithMessageOnly();
  testFormatCommitResultDetailForFailedWithCodeOnly();
  testFormatCommitResultDetailIgnoresNonFailedOutcomes();
  testFormatCommitResultLineIncludesFailedDetail();
  testFormatCommitResultLineIncludesTargetAndLineageWhenRequested();
}

main();
console.log("migration-commit-summary tests: OK");

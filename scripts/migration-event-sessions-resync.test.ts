import assert from "node:assert/strict";

import {
  isSourceUnpublishedError,
  parseArgs,
  protectedFieldsEqual,
  type ProtectedFieldsSnapshot,
} from "./migration-event-sessions-resync";

const REQUIRED = ["--source-record-key", "wordpress-db:events:62977", "--preview"];

function testRequiresAtLeastOneSourceRecordKey() {
  assert.throws(() => parseArgs(["--preview"]), /At least one --source-record-key/);
}

function testRejectsInvalidSourceRecordKeyFormat() {
  assert.throws(
    () => parseArgs(["--source-record-key", "wordpress-db:places:1", "--preview"]),
    /Invalid --source-record-key/,
  );
}

function testRequiresExactlyOneOfPreviewOrCommit() {
  assert.throws(
    () => parseArgs(["--source-record-key", "wordpress-db:events:62977"]),
    /exactly one of --preview or --commit/,
  );
  assert.throws(
    () => parseArgs(["--source-record-key", "wordpress-db:events:62977", "--preview", "--commit"]),
    /exactly one of --preview or --commit/,
  );
}

function testParsesMultipleSourceRecordKeys() {
  const args = parseArgs([
    "--source-record-key",
    "wordpress-db:events:62977",
    "--source-record-key",
    "wordpress-db:events:63510",
    "--commit",
    "--allow-remote-readonly",
  ]);
  assert.deepEqual(args.sourceRecordKeys, ["wordpress-db:events:62977", "wordpress-db:events:63510"]);
  assert.equal(args.commit, true);
  assert.equal(args.preview, false);
  assert.equal(args.allowRemoteReadonly, true);
}

function testParsesOutPath() {
  const args = parseArgs([...REQUIRED, "--out", "report.json"]);
  assert.equal(args.outPath, "report.json");
}

function testDefaultsAllowRemoteReadonlyFalse() {
  const args = parseArgs(REQUIRED);
  assert.equal(args.allowRemoteReadonly, false);
}

function fieldsFixture(overrides: Partial<ProtectedFieldsSnapshot> = {}): ProtectedFieldsSnapshot {
  return {
    status: "PUBLISHED",
    cityId: "city-1",
    venueCityId: "city-1",
    slug: "some-event",
    ownerUserId: "user-1",
    title: "Some Event",
    ...overrides,
  };
}

function testProtectedFieldsEqualTrueForIdenticalSnapshots() {
  assert.equal(protectedFieldsEqual(fieldsFixture(), fieldsFixture()), true);
}

function testProtectedFieldsEqualFalseOnStatusChange() {
  assert.equal(protectedFieldsEqual(fieldsFixture(), fieldsFixture({ status: "PENDING" })), false);
}

function testProtectedFieldsEqualFalseOnCityChange() {
  assert.equal(protectedFieldsEqual(fieldsFixture(), fieldsFixture({ cityId: "city-2" })), false);
  assert.equal(protectedFieldsEqual(fieldsFixture(), fieldsFixture({ cityId: null })), false);
}

function testProtectedFieldsEqualFalseOnVenueCityChange() {
  assert.equal(protectedFieldsEqual(fieldsFixture(), fieldsFixture({ venueCityId: null })), false);
}

function testIsSourceUnpublishedErrorMatchesExactMessage() {
  const err = new Error(
    'No published WordPress event found for sourceRecordKey "wordpress-db:events:64159" (post_type=events, post_status=publish).',
  );
  assert.equal(isSourceUnpublishedError(err), true);
}

function testIsSourceUnpublishedErrorFalseForOtherErrors() {
  assert.equal(isSourceUnpublishedError(new Error("connection refused")), false);
  assert.equal(isSourceUnpublishedError("not an Error instance"), false);
}

async function main() {
  testRequiresAtLeastOneSourceRecordKey();
  testRejectsInvalidSourceRecordKeyFormat();
  testRequiresExactlyOneOfPreviewOrCommit();
  testParsesMultipleSourceRecordKeys();
  testParsesOutPath();
  testDefaultsAllowRemoteReadonlyFalse();
  testProtectedFieldsEqualTrueForIdenticalSnapshots();
  testProtectedFieldsEqualFalseOnStatusChange();
  testProtectedFieldsEqualFalseOnCityChange();
  testProtectedFieldsEqualFalseOnVenueCityChange();
  testIsSourceUnpublishedErrorMatchesExactMessage();
  testIsSourceUnpublishedErrorFalseForOtherErrors();
  console.log("migration-event-sessions-resync tests: OK");
}

main().catch((error) => {
  console.error("migration-event-sessions-resync tests: FAILED", error);
  process.exitCode = 1;
});

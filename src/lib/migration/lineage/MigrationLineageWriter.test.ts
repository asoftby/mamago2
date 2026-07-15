import assert from "node:assert/strict";

import type { MigrationLineage } from "@prisma/client";

import { MigrationLineageWriter } from "./MigrationLineageWriter";
import type { CreateLineageInput, MigrationLineageWriterPrismaClient } from "./types";

function inputFixture(overrides: Partial<CreateLineageInput> = {}): CreateLineageInput {
  return {
    sourceId: "source-1",
    sourceEntityType: "wordpress-db:places",
    sourceStableKey: "wordpress-db:places:301",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    targetId: "place-1",
    lastSourceHash: "hash-a",
    runId: "run-1",
    recordId: "record-1",
    ...overrides,
  };
}

function lineageFixture(overrides: Partial<MigrationLineage> = {}): MigrationLineage {
  return {
    id: "lineage-1",
    sourceId: "source-1",
    recordId: "record-1",
    runId: "run-1",
    sourceEntityType: "wordpress-db:places",
    sourceExternalId: null,
    sourceStableKey: "wordpress-db:places:301",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    targetId: "place-1",
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

function createFakeClient(options: { returnRow?: MigrationLineage; throwError?: Error } = {}) {
  const calls: unknown[] = [];
  const client: MigrationLineageWriterPrismaClient = {
    migrationLineage: {
      create: (async (args: unknown) => {
        calls.push(args);
        if (options.throwError) {
          throw options.throwError;
        }
        return options.returnRow ?? lineageFixture();
      }) as unknown as MigrationLineageWriterPrismaClient["migrationLineage"]["create"],
    },
  };
  return { client, calls };
}

async function testHappyPathCallsCreateOnce() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);

  const result = await writer.createLineage(inputFixture());

  assert.equal(calls.length, 1);
  assert.deepEqual(result, {
    lineageId: "lineage-1",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    targetId: "place-1",
  });
}

async function testTargetRoleDefaultsToPrimary() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture());

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.targetRole, "primary");
}

async function testCustomTargetRole() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture({ targetRole: "cover" }));

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.targetRole, "cover");
}

async function testLastSourceHashSavedExactlyAsPassed() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture({ lastSourceHash: "sha256-deadbeef" }));

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.lastSourceHash, "sha256-deadbeef");
}

async function testRunIdAndRecordIdSavedIntoCorrectFields() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture({ runId: "run-42", recordId: "record-42" }));

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.runId, "run-42");
  assert.equal(call.data.recordId, "record-42");
}

async function testNoUpsertUpdateOrFindIsCalled() {
  // The injected client type only exposes `create` — structurally there is
  // no `upsert`/`update`/`findUnique`/`findFirst` to call. This test
  // confirms the one call that *is* made is exactly `create`'s shape
  // (a `data` object, not a `where`+`update`/`create` upsert shape).
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture());

  const call = calls[0] as Record<string, unknown>;
  assert.ok("data" in call);
  assert.ok(!("where" in call), "a plain create() call must never carry a where clause");
  assert.ok(!("update" in call), "a plain create() call must never carry an update clause");
}

async function testMissingSourceIdThrows() {
  const { client } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await assert.rejects(() => writer.createLineage(inputFixture({ sourceId: "" })));
}

async function testMissingSourceRecordKeyThrows() {
  const { client } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await assert.rejects(() => writer.createLineage(inputFixture({ sourceRecordKey: "" })));
}

async function testMissingTargetIdThrows() {
  const { client } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await assert.rejects(() => writer.createLineage(inputFixture({ targetId: "" })));
}

async function testMissingLastSourceHashThrows() {
  const { client } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await assert.rejects(() => writer.createLineage(inputFixture({ lastSourceHash: "" })));
}

async function testLastImportedAtStampedFromInjectedClock() {
  const { client, calls } = createFakeClient();
  const fixedNow = new Date("2026-07-15T12:00:00.000Z");
  const writer = new MigrationLineageWriter(client, () => fixedNow);
  await writer.createLineage(inputFixture());

  const call = calls[0] as { data: Record<string, unknown> };
  assert.equal(call.data.lastImportedAt, fixedNow);
}

async function testLastImportedAtDefaultsToRealClockWhenNotInjected() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  const before = Date.now();
  await writer.createLineage(inputFixture());
  const after = Date.now();

  const call = calls[0] as { data: Record<string, unknown> };
  const stamped = call.data.lastImportedAt as Date;
  assert.ok(stamped instanceof Date);
  assert.ok(stamped.getTime() >= before && stamped.getTime() <= after);
}

async function testUniqueConstraintErrorPropagatesNotSwallowed() {
  const uniqueConstraintError = Object.assign(
    new Error("Unique constraint failed on the fields: (`sourceId`,`sourceRecordKey`,`targetType`,`targetRole`)"),
    { code: "P2002" },
  );
  const { client } = createFakeClient({ throwError: uniqueConstraintError });
  const writer = new MigrationLineageWriter(client);

  await assert.rejects(
    () => writer.createLineage(inputFixture()),
    (error: unknown) => error === uniqueConstraintError,
  );
}

async function main() {
  await testHappyPathCallsCreateOnce();
  await testTargetRoleDefaultsToPrimary();
  await testCustomTargetRole();
  await testLastSourceHashSavedExactlyAsPassed();
  await testRunIdAndRecordIdSavedIntoCorrectFields();
  await testNoUpsertUpdateOrFindIsCalled();
  await testMissingSourceIdThrows();
  await testMissingSourceRecordKeyThrows();
  await testMissingTargetIdThrows();
  await testMissingLastSourceHashThrows();
  await testLastImportedAtStampedFromInjectedClock();
  await testLastImportedAtDefaultsToRealClockWhenNotInjected();
  await testUniqueConstraintErrorPropagatesNotSwallowed();
}

main()
  .then(() => {
    console.log("MigrationLineageWriter tests: OK");
  })
  .catch((error) => {
    console.error("MigrationLineageWriter tests: FAILED", error);
    process.exitCode = 1;
  });

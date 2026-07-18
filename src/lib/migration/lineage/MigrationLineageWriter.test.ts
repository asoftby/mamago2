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

function fakeUniqueConstraintError(): Error {
  return Object.assign(
    new Error("Unique constraint failed on the fields: (`sourceId`,`sourceRecordKey`,`targetType`,`targetRole`)"),
    { code: "P2002", clientVersion: "test", name: "PrismaClientKnownRequestError" },
  );
}

type FakeCall = { method: "create" | "updateMany" | "findUniqueOrThrow"; args: unknown };

/**
 * `createThrows`, when set, is thrown by `create()` — used to simulate the
 * unique-constraint conflict path. `updateManyCount` controls whether the
 * simulated reactivation "finds" an inactive row (`1`) or not (`0`,
 * default — simulating an active-row conflict).
 */
function createFakeClient(
  options: {
    createThrows?: Error;
    updateManyCount?: number;
    reactivatedRow?: MigrationLineage;
  } = {},
) {
  const calls: FakeCall[] = [];
  const client: MigrationLineageWriterPrismaClient = {
    migrationLineage: {
      create: (async (args: unknown) => {
        calls.push({ method: "create", args });
        if (options.createThrows) {
          throw options.createThrows;
        }
        return lineageFixture();
      }) as unknown as MigrationLineageWriterPrismaClient["migrationLineage"]["create"],
      updateMany: (async (args: unknown) => {
        calls.push({ method: "updateMany", args });
        return { count: options.updateManyCount ?? 0 };
      }) as unknown as MigrationLineageWriterPrismaClient["migrationLineage"]["updateMany"],
      findUniqueOrThrow: (async (args: unknown) => {
        calls.push({ method: "findUniqueOrThrow", args });
        return options.reactivatedRow ?? lineageFixture({ id: "lineage-1", isActive: true });
      }) as unknown as MigrationLineageWriterPrismaClient["migrationLineage"]["findUniqueOrThrow"],
    },
  };
  return { client, calls };
}

function dataOf(call: FakeCall): Record<string, unknown> {
  return (call.args as { data: Record<string, unknown> }).data;
}

function whereOf(call: FakeCall): Record<string, unknown> {
  return (call.args as { where: Record<string, unknown> }).where;
}

async function testHappyPathCallsCreateOnce() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);

  const result = await writer.createLineage(inputFixture());

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "create");
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

  assert.equal(dataOf(calls[0]!).targetRole, "primary");
}

async function testCustomTargetRole() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture({ targetRole: "cover" }));

  assert.equal(dataOf(calls[0]!).targetRole, "cover");
}

async function testLastSourceHashSavedExactlyAsPassed() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture({ lastSourceHash: "sha256-deadbeef" }));

  assert.equal(dataOf(calls[0]!).lastSourceHash, "sha256-deadbeef");
}

async function testRunIdAndRecordIdSavedIntoCorrectFields() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture({ runId: "run-42", recordId: "record-42" }));

  assert.equal(dataOf(calls[0]!).runId, "run-42");
  assert.equal(dataOf(calls[0]!).recordId, "record-42");
}

async function testHappyPathOnlyCallsCreateNoUpdateOrFind() {
  // The common (no prior row) case must still be exactly one create() call
  // — updateMany()/findUniqueOrThrow() only exist for the reactivation path
  // (see the reactivation tests below), never touched on the happy path.
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture());

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.method, "create");
  assert.ok("data" in (calls[0]!.args as object));
  assert.ok(!("where" in (calls[0]!.args as object)), "a plain create() call must never carry a where clause");
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

  assert.equal(dataOf(calls[0]!).lastImportedAt, fixedNow);
}

async function testLastImportedAtDefaultsToRealClockWhenNotInjected() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationLineageWriter(client);
  const before = Date.now();
  await writer.createLineage(inputFixture());
  const after = Date.now();

  const stamped = dataOf(calls[0]!).lastImportedAt as Date;
  assert.ok(stamped instanceof Date);
  assert.ok(stamped.getTime() >= before && stamped.getTime() <= after);
}

async function testNonUniqueErrorsPropagateUnchangedWithoutReactivationAttempt() {
  const infraError = new Error("connection reset");
  const { client, calls } = createFakeClient({ createThrows: infraError });
  const writer = new MigrationLineageWriter(client);

  await assert.rejects(
    () => writer.createLineage(inputFixture()),
    (error: unknown) => error === infraError,
  );
  assert.equal(calls.length, 1, "no reactivation attempt for a non-unique-constraint error");
}

async function testReactivatesInactiveRowOnUniqueConflict() {
  const { client, calls } = createFakeClient({
    createThrows: fakeUniqueConstraintError(),
    updateManyCount: 1,
    reactivatedRow: lineageFixture({ id: "lineage-1", targetId: "place-99", isActive: true }),
  });
  const writer = new MigrationLineageWriter(client);

  const result = await writer.createLineage(inputFixture({ targetId: "place-99" }));

  assert.deepEqual(
    calls.map((c) => c.method),
    ["create", "updateMany", "findUniqueOrThrow"],
  );
  assert.deepEqual(result, {
    lineageId: "lineage-1",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    targetId: "place-99",
  });
}

async function testReactivationGuardedByExactKeyAndInactiveOnly() {
  const { client, calls } = createFakeClient({ createThrows: fakeUniqueConstraintError(), updateManyCount: 1 });
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture({ targetRole: "cover" }));

  const updateManyCall = calls.find((c) => c.method === "updateMany")!;
  assert.deepEqual(whereOf(updateManyCall), {
    sourceId: "source-1",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    targetRole: "cover",
    isActive: false,
  });
}

async function testReactivationUpdatesAllMutableFields() {
  const fixedNow = new Date("2026-07-19T00:00:00.000Z");
  const { client, calls } = createFakeClient({ createThrows: fakeUniqueConstraintError(), updateManyCount: 1 });
  const writer = new MigrationLineageWriter(client, () => fixedNow);
  await writer.createLineage(
    inputFixture({ targetId: "place-99", targetStableKey: "place-99-slug", lastSourceHash: "hash-b", runId: "run-7", recordId: "record-7" }),
  );

  const updateManyCall = calls.find((c) => c.method === "updateMany")!;
  assert.deepEqual(dataOf(updateManyCall), {
    targetId: "place-99",
    targetNaturalKey: "place-99-slug",
    lastSourceHash: "hash-b",
    runId: "run-7",
    recordId: "record-7",
    isActive: true,
    lastImportedAt: fixedNow,
  });
}

async function testFindUniqueOrThrowUsesCompoundUniqueKeyAfterReactivation() {
  const { client, calls } = createFakeClient({ createThrows: fakeUniqueConstraintError(), updateManyCount: 1 });
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture());

  const findCall = calls.find((c) => c.method === "findUniqueOrThrow")!;
  assert.deepEqual(whereOf(findCall), {
    sourceId_sourceRecordKey_targetType_targetRole: {
      sourceId: "source-1",
      sourceRecordKey: "wordpress-db:places:301",
      targetType: "PLACE",
      targetRole: "primary",
    },
  });
}

async function testActiveLineageConflictThrowsWithoutOverwriting() {
  // updateManyCount defaults to 0 — simulates the guarded update() finding
  // no matching *inactive* row, i.e. the existing row at this exact key is
  // active. Must throw a clear, descriptive error, never silently overwrite.
  const { client, calls } = createFakeClient({ createThrows: fakeUniqueConstraintError(), updateManyCount: 0 });
  const writer = new MigrationLineageWriter(client);

  await assert.rejects(() => writer.createLineage(inputFixture()), /refusing to overwrite an active mapping/);
  assert.deepEqual(
    calls.map((c) => c.method),
    ["create", "updateMany"],
    "must never reach findUniqueOrThrow when the row is active — nothing to fetch, nothing was changed",
  );
}

async function main() {
  await testHappyPathCallsCreateOnce();
  await testTargetRoleDefaultsToPrimary();
  await testCustomTargetRole();
  await testLastSourceHashSavedExactlyAsPassed();
  await testRunIdAndRecordIdSavedIntoCorrectFields();
  await testHappyPathOnlyCallsCreateNoUpdateOrFind();
  await testMissingSourceIdThrows();
  await testMissingSourceRecordKeyThrows();
  await testMissingTargetIdThrows();
  await testMissingLastSourceHashThrows();
  await testLastImportedAtStampedFromInjectedClock();
  await testLastImportedAtDefaultsToRealClockWhenNotInjected();
  await testNonUniqueErrorsPropagateUnchangedWithoutReactivationAttempt();
  await testReactivatesInactiveRowOnUniqueConflict();
  await testReactivationGuardedByExactKeyAndInactiveOnly();
  await testReactivationUpdatesAllMutableFields();
  await testFindUniqueOrThrowUsesCompoundUniqueKeyAfterReactivation();
  await testActiveLineageConflictThrowsWithoutOverwriting();
}

main()
  .then(() => {
    console.log("MigrationLineageWriter tests: OK");
  })
  .catch((error) => {
    console.error("MigrationLineageWriter tests: FAILED", error);
    process.exitCode = 1;
  });

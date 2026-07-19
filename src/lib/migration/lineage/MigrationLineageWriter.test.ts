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

type FakeCall = { method: "create" | "updateMany" | "findUnique" | "findUniqueOrThrow"; args: unknown };

/**
 * `updateManyCount` controls the guarded-reactivation outcome tried first
 * (`1` = an inactive row was reactivated, `0` = nothing matched — either no
 * row exists, or an existing one is active). `existingRow`, when
 * `updateManyCount` is `0`, is what `findUnique()` returns to distinguish
 * those two cases: `null` (no row at all, falls through to `create()`) or a
 * row (active-conflict, must throw without ever calling `create()`).
 * `createThrows`, when set, is thrown by the final `create()` — used only
 * to simulate a genuine concurrent-insert race.
 */
function createFakeClient(
  options: {
    updateManyCount?: number;
    existingRow?: MigrationLineage | null;
    reactivatedRow?: MigrationLineage;
    createThrows?: Error;
  } = {},
) {
  const calls: FakeCall[] = [];
  const client: MigrationLineageWriterPrismaClient = {
    migrationLineage: {
      updateMany: (async (args: unknown) => {
        calls.push({ method: "updateMany", args });
        return { count: options.updateManyCount ?? 1 };
      }) as unknown as MigrationLineageWriterPrismaClient["migrationLineage"]["updateMany"],
      findUniqueOrThrow: (async (args: unknown) => {
        calls.push({ method: "findUniqueOrThrow", args });
        return options.reactivatedRow ?? lineageFixture({ id: "lineage-1", isActive: true });
      }) as unknown as MigrationLineageWriterPrismaClient["migrationLineage"]["findUniqueOrThrow"],
      findUnique: (async (args: unknown) => {
        calls.push({ method: "findUnique", args });
        return options.existingRow ?? null;
      }) as unknown as MigrationLineageWriterPrismaClient["migrationLineage"]["findUnique"],
      create: (async (args: unknown) => {
        calls.push({ method: "create", args });
        if (options.createThrows) {
          throw options.createThrows;
        }
        return lineageFixture();
      }) as unknown as MigrationLineageWriterPrismaClient["migrationLineage"]["create"],
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

// --- 1. Inactive lineage exists: reactivated, never a create() call. ---

async function testInactiveLineageReactivatedFirstNoCreate() {
  const { client, calls } = createFakeClient({
    updateManyCount: 1,
    reactivatedRow: lineageFixture({ id: "lineage-1", targetId: "place-99", isActive: true }),
  });
  const writer = new MigrationLineageWriter(client);

  const result = await writer.createLineage(inputFixture({ targetId: "place-99" }));

  assert.deepEqual(
    calls.map((c) => c.method),
    ["updateMany", "findUniqueOrThrow"],
    "reactivation is attempted first, before any create() — no failing statement precedes it",
  );
  assert.deepEqual(result, {
    lineageId: "lineage-1",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    targetId: "place-99",
  });
}

async function testReactivationGuardedByExactKeyAndInactiveOnly() {
  const { client, calls } = createFakeClient({ updateManyCount: 1 });
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

async function testReactivationUpdatesAllMutableFieldsAndMarksActive() {
  const fixedNow = new Date("2026-07-19T00:00:00.000Z");
  const { client, calls } = createFakeClient({ updateManyCount: 1 });
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

async function testReactivationFetchesSameRowByCompoundUniqueKey() {
  const { client, calls } = createFakeClient({ updateManyCount: 1 });
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

// --- 2. Active lineage exists: deterministic conflict, no create(). ---

async function testActiveLineageConflictThrowsWithoutOverwriting() {
  const { client, calls } = createFakeClient({
    updateManyCount: 0,
    existingRow: lineageFixture({ id: "lineage-1", targetId: "place-1", isActive: true }),
  });
  const writer = new MigrationLineageWriter(client);

  await assert.rejects(() => writer.createLineage(inputFixture({ targetId: "place-99" })), /refusing to overwrite an active mapping/);
  assert.deepEqual(
    calls.map((c) => c.method),
    ["updateMany", "findUnique"],
    "must never reach create() when an active row already exists — nothing written, nothing overwritten",
  );
}

// --- 3. No lineage at all: falls through to create(), exactly once. ---

async function testNoExistingRowFallsThroughToCreate() {
  const { client, calls } = createFakeClient({ updateManyCount: 0, existingRow: null });
  const writer = new MigrationLineageWriter(client);

  const result = await writer.createLineage(inputFixture());

  assert.deepEqual(
    calls.map((c) => c.method),
    ["updateMany", "findUnique", "create"],
  );
  assert.deepEqual(result, {
    lineageId: "lineage-1",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    targetId: "place-1",
  });
}

async function testTargetRoleDefaultsToPrimary() {
  const { client, calls } = createFakeClient({ updateManyCount: 0, existingRow: null });
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture());

  const createCall = calls.find((c) => c.method === "create")!;
  assert.equal(dataOf(createCall).targetRole, "primary");
}

async function testCustomTargetRole() {
  const { client, calls } = createFakeClient({ updateManyCount: 0, existingRow: null });
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture({ targetRole: "cover" }));

  const createCall = calls.find((c) => c.method === "create")!;
  assert.equal(dataOf(createCall).targetRole, "cover");
}

async function testLastSourceHashSavedExactlyAsPassed() {
  const { client, calls } = createFakeClient({ updateManyCount: 0, existingRow: null });
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture({ lastSourceHash: "sha256-deadbeef" }));

  const createCall = calls.find((c) => c.method === "create")!;
  assert.equal(dataOf(createCall).lastSourceHash, "sha256-deadbeef");
}

async function testRunIdAndRecordIdSavedIntoCorrectFields() {
  const { client, calls } = createFakeClient({ updateManyCount: 0, existingRow: null });
  const writer = new MigrationLineageWriter(client);
  await writer.createLineage(inputFixture({ runId: "run-42", recordId: "record-42" }));

  const createCall = calls.find((c) => c.method === "create")!;
  assert.equal(dataOf(createCall).runId, "run-42");
  assert.equal(dataOf(createCall).recordId, "record-42");
}

async function testLastImportedAtStampedFromInjectedClockOnCreate() {
  const { client, calls } = createFakeClient({ updateManyCount: 0, existingRow: null });
  const fixedNow = new Date("2026-07-15T12:00:00.000Z");
  const writer = new MigrationLineageWriter(client, () => fixedNow);
  await writer.createLineage(inputFixture());

  const createCall = calls.find((c) => c.method === "create")!;
  assert.equal(dataOf(createCall).lastImportedAt, fixedNow);
}

async function testLastImportedAtDefaultsToRealClockWhenNotInjected() {
  const { client, calls } = createFakeClient({ updateManyCount: 0, existingRow: null });
  const writer = new MigrationLineageWriter(client);
  const before = Date.now();
  await writer.createLineage(inputFixture());
  const after = Date.now();

  const createCall = calls.find((c) => c.method === "create")!;
  const stamped = dataOf(createCall).lastImportedAt as Date;
  assert.ok(stamped instanceof Date);
  assert.ok(stamped.getTime() >= before && stamped.getTime() <= after);
}

// --- 4. Genuine concurrent-insert race on the final create(): propagates, no recovery attempt. ---

async function testConcurrentCreateConflictPropagatesWithoutRecoveryAttempt() {
  const { client, calls } = createFakeClient({
    updateManyCount: 0,
    existingRow: null,
    createThrows: fakeUniqueConstraintError(),
  });
  const writer = new MigrationLineageWriter(client);

  await assert.rejects(
    () => writer.createLineage(inputFixture()),
    (error: unknown) => (error as { code?: string }).code === "P2002",
  );
  assert.deepEqual(
    calls.map((c) => c.method),
    ["updateMany", "findUnique", "create"],
    "no further statement is attempted after create() fails — the error propagates for the caller's own transaction to roll back",
  );
}

async function testNonUniqueCreateErrorAlsoPropagatesUnchanged() {
  const infraError = new Error("connection reset");
  const { client, calls } = createFakeClient({ updateManyCount: 0, existingRow: null, createThrows: infraError });
  const writer = new MigrationLineageWriter(client);

  await assert.rejects(
    () => writer.createLineage(inputFixture()),
    (error: unknown) => error === infraError,
  );
  assert.deepEqual(calls.map((c) => c.method), ["updateMany", "findUnique", "create"]);
}

// --- Input validation (unchanged). ---

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

async function main() {
  await testInactiveLineageReactivatedFirstNoCreate();
  await testReactivationGuardedByExactKeyAndInactiveOnly();
  await testReactivationUpdatesAllMutableFieldsAndMarksActive();
  await testReactivationFetchesSameRowByCompoundUniqueKey();
  await testActiveLineageConflictThrowsWithoutOverwriting();
  await testNoExistingRowFallsThroughToCreate();
  await testTargetRoleDefaultsToPrimary();
  await testCustomTargetRole();
  await testLastSourceHashSavedExactlyAsPassed();
  await testRunIdAndRecordIdSavedIntoCorrectFields();
  await testLastImportedAtStampedFromInjectedClockOnCreate();
  await testLastImportedAtDefaultsToRealClockWhenNotInjected();
  await testConcurrentCreateConflictPropagatesWithoutRecoveryAttempt();
  await testNonUniqueCreateErrorAlsoPropagatesUnchanged();
  await testMissingSourceIdThrows();
  await testMissingSourceRecordKeyThrows();
  await testMissingTargetIdThrows();
  await testMissingLastSourceHashThrows();
}

main()
  .then(() => {
    console.log("MigrationLineageWriter tests: OK");
  })
  .catch((error) => {
    console.error("MigrationLineageWriter tests: FAILED", error);
    process.exitCode = 1;
  });

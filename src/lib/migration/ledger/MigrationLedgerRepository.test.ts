import assert from "node:assert/strict";

import type { MigrationLineage, MigrationRun, MigrationSource } from "@prisma/client";

import { getLineageActionForRecord, MigrationLedgerRepository } from "./MigrationLedgerRepository";
import type { MigrationLedgerPrismaClient } from "./types";

// ---------------------------------------------------------------------------
// Fixtures — full rows (every column populated) so they satisfy Prisma's
// generated model types exactly, without a real database.
// ---------------------------------------------------------------------------

function migrationSource(overrides: Partial<MigrationSource> = {}): MigrationSource {
  return {
    id: "source-1",
    adapterKey: "wordpress-db",
    sourceNamespace: "wordpress-db",
    name: "WordPress DB",
    status: "ACTIVE",
    config: null,
    scope: null,
    capabilities: null,
    notes: null,
    lastRunAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function migrationRun(overrides: Partial<MigrationRun> = {}): MigrationRun {
  return {
    id: "run-1",
    sourceId: "source-1",
    mode: "DRY_RUN",
    status: "COMPLETED",
    adapterVersion: "1.0.0",
    triggerType: null,
    triggerUserId: null,
    resumedFromRunId: null,
    snapshotHash: null,
    snapshotRef: null,
    planHash: null,
    counters: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function migrationLineage(overrides: Partial<MigrationLineage> = {}): MigrationLineage {
  return {
    id: "lineage-1",
    sourceId: "source-1",
    recordId: null,
    runId: null,
    sourceEntityType: "wordpress-db:places",
    sourceExternalId: null,
    sourceStableKey: "wordpress-db:places:301",
    sourceRecordKey: "wordpress-db:places:301",
    targetType: "PLACE",
    targetId: "place-1",
    targetRole: "primary",
    targetNaturalKey: null,
    lastSourceHash: "hash-a",
    lastPlanAction: "CREATE",
    isActive: true,
    firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSeenAt: null,
    lastImportedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fake Prisma client — records calls, returns preset data. No live DB.
// ---------------------------------------------------------------------------

interface FakeClientOptions {
  source?: MigrationSource | null;
  lineageRows?: MigrationLineage[];
}

function createFakeClient(options: FakeClientOptions = {}) {
  const calls = {
    findUnique: [] as unknown[],
    findFirst: [] as unknown[],
    findMany: [] as unknown[],
  };

  const client: MigrationLedgerPrismaClient = {
    migrationSource: {
      findUnique: (async (args: unknown) => {
        calls.findUnique.push(args);
        return options.source ?? null;
      }) as MigrationLedgerPrismaClient["migrationSource"]["findUnique"],
    },
    migrationRun: {
      findFirst: (async (args: unknown) => {
        calls.findFirst.push(args);
        return migrationRun();
      }) as MigrationLedgerPrismaClient["migrationRun"]["findFirst"],
    },
    migrationLineage: {
      findMany: (async (args: unknown) => {
        calls.findMany.push(args);
        return options.lineageRows ?? [];
      }) as MigrationLedgerPrismaClient["migrationLineage"]["findMany"],
    },
  };

  return { client, calls };
}

async function testFindSourceByAdapterUsesCompoundUniqueKey() {
  const source = migrationSource();
  const { client, calls } = createFakeClient({ source });
  const repository = new MigrationLedgerRepository(client);

  const result = await repository.findSourceByAdapter("wordpress-db", "wordpress-db");

  assert.deepEqual(result, source);
  assert.equal(calls.findUnique.length, 1);
  assert.deepEqual(calls.findUnique[0], {
    where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: "wordpress-db" } },
  });
}

async function testFindLatestRunOrdersByCreatedAtDesc() {
  const { client, calls } = createFakeClient();
  const repository = new MigrationLedgerRepository(client);

  const run = await repository.findLatestRun("source-1");

  assert.ok(run);
  assert.equal(calls.findFirst.length, 1);
  assert.deepEqual(calls.findFirst[0], {
    where: { sourceId: "source-1" },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
}

async function testFindLineageSourceNotFoundReturnsEmptyMap() {
  const { client, calls } = createFakeClient({ source: null });
  const repository = new MigrationLedgerRepository(client);

  const result = await repository.findLineageBySourceRecordKeys({
    adapterKey: "wordpress-db",
    sourceNamespace: "wordpress-db",
    keys: ["wordpress-db:places:301"],
  });

  assert.equal(result.size, 0);
  assert.equal(calls.findMany.length, 0);
}

async function testFindLineageEmptyKeysReturnsEmptyMapWithoutAnyLookup() {
  const { client, calls } = createFakeClient({ source: migrationSource() });
  const repository = new MigrationLedgerRepository(client);

  const result = await repository.findLineageBySourceRecordKeys({
    adapterKey: "wordpress-db",
    sourceNamespace: "wordpress-db",
    keys: [],
  });

  assert.equal(result.size, 0);
  assert.equal(calls.findMany.length, 0, "lineage.findMany must not be called for an empty key list");
  assert.equal(calls.findUnique.length, 0, "source lookup should be skipped entirely for an empty key list");
}

async function testFindLineageReadsActiveLineageByKeys() {
  const source = migrationSource();
  const row = migrationLineage();
  const { client, calls } = createFakeClient({ source, lineageRows: [row] });
  const repository = new MigrationLedgerRepository(client);

  const result = await repository.findLineageBySourceRecordKeys({
    adapterKey: "wordpress-db",
    sourceNamespace: "wordpress-db",
    keys: ["wordpress-db:places:301"],
  });

  assert.equal(calls.findMany.length, 1);
  const args = calls.findMany[0] as { where: Record<string, unknown> };
  assert.equal(args.where.sourceId, source.id);
  assert.deepEqual(args.where.sourceRecordKey, { in: ["wordpress-db:places:301"] });
  assert.equal(args.where.isActive, true);
  assert.ok(!("targetType" in args.where), "targetType filter must be absent when not requested");
  assert.ok(!("targetRole" in args.where), "targetRole filter must be absent when not requested");

  assert.equal(result.size, 1);
  assert.deepEqual(result.get("wordpress-db:places:301"), [row]);
}

async function testFindLineageGroupsMultipleRowsBySourceRecordKey() {
  const source = migrationSource();
  const rowA = migrationLineage({ id: "lineage-a", targetType: "PLACE", targetRole: "primary" });
  const rowB = migrationLineage({ id: "lineage-b", targetType: "MEDIA_ASSET", targetRole: "cover" });
  const { client } = createFakeClient({ source, lineageRows: [rowA, rowB] });
  const repository = new MigrationLedgerRepository(client);

  const result = await repository.findLineageBySourceRecordKeys({
    adapterKey: "wordpress-db",
    sourceNamespace: "wordpress-db",
    keys: ["wordpress-db:places:301"],
  });

  assert.deepEqual(result.get("wordpress-db:places:301"), [rowA, rowB]);
}

async function testFindLineageSupportsOptionalTargetTypeAndRole() {
  const source = migrationSource();
  const { client, calls } = createFakeClient({ source, lineageRows: [] });
  const repository = new MigrationLedgerRepository(client);

  await repository.findLineageBySourceRecordKeys({
    adapterKey: "wordpress-db",
    sourceNamespace: "wordpress-db",
    keys: ["wordpress-db:places:301"],
    targetType: "PLACE",
    targetRole: "cover",
  });

  const args = calls.findMany[0] as { where: Record<string, unknown> };
  assert.equal(args.where.targetType, "PLACE");
  assert.equal(args.where.targetRole, "cover");
}

function testGetLineageActionForRecordNoLineageIsCreate() {
  const action = getLineageActionForRecord({ lineage: undefined, targetType: "PLACE", sourceHash: "hash-a" });
  assert.equal(action, "CREATE");

  const actionEmptyArray = getLineageActionForRecord({ lineage: [], targetType: "PLACE", sourceHash: "hash-a" });
  assert.equal(actionEmptyArray, "CREATE");
}

function testGetLineageActionForRecordSameHashIsSkipUnchanged() {
  const row = migrationLineage({ targetType: "PLACE", lastSourceHash: "hash-a" });
  const action = getLineageActionForRecord({ lineage: [row], targetType: "PLACE", sourceHash: "hash-a" });
  assert.equal(action, "SKIP_UNCHANGED");
}

function testGetLineageActionForRecordDifferentHashIsUpdate() {
  const row = migrationLineage({ targetType: "PLACE", lastSourceHash: "hash-a" });
  const action = getLineageActionForRecord({ lineage: [row], targetType: "PLACE", sourceHash: "hash-b" });
  assert.equal(action, "UPDATE");
}

function testGetLineageActionForRecordWrongTargetTypeIsCreate() {
  const row = migrationLineage({ targetType: "MEDIA_ASSET", lastSourceHash: "hash-a" });
  const action = getLineageActionForRecord({ lineage: [row], targetType: "PLACE", sourceHash: "hash-a" });
  assert.equal(action, "CREATE");
}

function testGetLineageActionForRecordMixedLineagePicksMatchingTargetType() {
  const mediaRow = migrationLineage({ id: "media", targetType: "MEDIA_ASSET", lastSourceHash: "hash-a" });
  const placeRowSameHash = migrationLineage({ id: "place-same", targetType: "PLACE", lastSourceHash: "hash-a" });
  const actionSame = getLineageActionForRecord({
    lineage: [mediaRow, placeRowSameHash],
    targetType: "PLACE",
    sourceHash: "hash-a",
  });
  assert.equal(actionSame, "SKIP_UNCHANGED");

  const placeRowDifferentHash = migrationLineage({ id: "place-diff", targetType: "PLACE", lastSourceHash: "hash-a" });
  const actionDiff = getLineageActionForRecord({
    lineage: [mediaRow, placeRowDifferentHash],
    targetType: "PLACE",
    sourceHash: "hash-b",
  });
  assert.equal(actionDiff, "UPDATE");
}

async function main() {
  await testFindSourceByAdapterUsesCompoundUniqueKey();
  await testFindLatestRunOrdersByCreatedAtDesc();
  await testFindLineageSourceNotFoundReturnsEmptyMap();
  await testFindLineageEmptyKeysReturnsEmptyMapWithoutAnyLookup();
  await testFindLineageReadsActiveLineageByKeys();
  await testFindLineageGroupsMultipleRowsBySourceRecordKey();
  await testFindLineageSupportsOptionalTargetTypeAndRole();
  testGetLineageActionForRecordNoLineageIsCreate();
  testGetLineageActionForRecordSameHashIsSkipUnchanged();
  testGetLineageActionForRecordDifferentHashIsUpdate();
  testGetLineageActionForRecordWrongTargetTypeIsCreate();
  testGetLineageActionForRecordMixedLineagePicksMatchingTargetType();
}

main()
  .then(() => {
    console.log("MigrationLedgerRepository tests: OK");
  })
  .catch((error) => {
    console.error("MigrationLedgerRepository tests: FAILED", error);
    process.exitCode = 1;
  });

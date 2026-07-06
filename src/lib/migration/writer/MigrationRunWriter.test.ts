import assert from "node:assert/strict";

import { Prisma } from "@prisma/client";
import type { MigrationRecord, MigrationRun, MigrationSource } from "@prisma/client";

import { MigrationRunWriter } from "./MigrationRunWriter";
import type { MigrationRunWriterPrismaClient } from "./types";
import type { MigrationPlan } from "../types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function sourceFixture(overrides: Partial<MigrationSource> = {}): MigrationSource {
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

function runFixture(overrides: Partial<MigrationRun> = {}): MigrationRun {
  return {
    id: "run-1",
    sourceId: "source-1",
    mode: "DRY_RUN",
    status: "RUNNING",
    adapterVersion: "1.0.0",
    triggerType: null,
    triggerUserId: null,
    resumedFromRunId: null,
    snapshotHash: null,
    snapshotRef: null,
    planHash: null,
    counters: null,
    errorMessage: null,
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    finishedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

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
    sourceStableKey: "wordpress-db:post:1",
    sourceRecordKey: "wordpress-db:post:1",
    sourceUrl: null,
    canonicalSourceUrl: null,
    sourceUpdatedAt: null,
    sourceHash: null,
    rawPayloadRef: null,
    rawPayload: null,
    normalizedPayloadRef: null,
    normalizedPayload: null,
    targetTypeHint: null,
    planAction: null,
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

function planFixture(overrides: Partial<MigrationPlan> = {}): MigrationPlan {
  return {
    adapterKey: "wordpress-db",
    adapterVersion: "1.0.0",
    sourceNamespace: "wordpress-db",
    mode: "DRY_RUN",
    createdAt: "2026-01-01T00:00:00.000Z",
    records: [
      {
        sourceEntityType: "wordpress-db:post",
        sourceStableKey: "wordpress-db:post:201",
        sourceRecordKey: "wordpress-db:post:201",
        sourceHash: "hash-a",
        sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        sourceEntityType: "wordpress-db:post",
        sourceStableKey: "wordpress-db:post:202",
        sourceRecordKey: "wordpress-db:post:202",
        sourceHash: "hash-b",
      },
    ],
    items: [
      {
        sourceRecordKey: "wordpress-db:post:201",
        sourceEntityType: "wordpress-db:post",
        action: "CREATE",
        status: "PLANNED",
        targetType: "ARTICLE",
        summary: { title: "Article One", slug: "article-one" },
        warnings: [{ code: "ARTICLE_MISSING_FEATURED_IMAGE", message: "no thumbnail", severity: "WARNING" }],
      },
      {
        sourceRecordKey: "wordpress-db:post:202",
        sourceEntityType: "wordpress-db:post",
        action: "FAIL",
        status: "FAILED",
      },
    ],
    warnings: [],
    errors: [
      {
        code: "NORMALIZE_FAILED",
        message: "boom",
        severity: "ERROR",
        sourceRecordKey: "wordpress-db:post:202",
        retryable: false,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fake Prisma client — records calls, echoes back `data`. No live DB.
// migrationLineage/migrationReviewTask/migrationMediaAsset/migrationRedirect
// aren't defined at all here — structurally impossible to call them through
// `MigrationRunWriterPrismaClient`.
// ---------------------------------------------------------------------------

function createFakeClient(options: { withTransaction?: boolean; failCreate?: boolean } = {}) {
  const calls = {
    upsertSource: [] as unknown[],
    createRun: [] as unknown[],
    createRecord: [] as unknown[],
    updateRun: [] as unknown[],
    transaction: [] as unknown[],
  };

  const client: MigrationRunWriterPrismaClient = {
    migrationSource: {
      upsert: (async (args: unknown) => {
        calls.upsertSource.push(args);
        return sourceFixture();
      }) as MigrationRunWriterPrismaClient["migrationSource"]["upsert"],
    },
    migrationRun: {
      create: (async (args: unknown) => {
        calls.createRun.push(args);
        return runFixture({ ...(args as { data: Record<string, unknown> }).data } as Partial<MigrationRun>);
      }) as unknown as MigrationRunWriterPrismaClient["migrationRun"]["create"],
      update: (async (args: unknown) => {
        calls.updateRun.push(args);
        return runFixture({ ...(args as { data: Record<string, unknown> }).data } as Partial<MigrationRun>);
      }) as unknown as MigrationRunWriterPrismaClient["migrationRun"]["update"],
    },
    migrationRecord: {
      create: (async (args: unknown) => {
        calls.createRecord.push(args);
        const data = (args as { data: Record<string, unknown> }).data;
        if (options.failCreate && data.sourceRecordKey === "wordpress-db:post:202") {
          throw new Error("db unavailable");
        }
        return recordFixture({ ...data } as Partial<MigrationRecord>);
      }) as unknown as MigrationRunWriterPrismaClient["migrationRecord"]["create"],
    },
  };

  if (options.withTransaction) {
    client.$transaction = (async (operations: readonly PromiseLike<unknown>[]) => {
      calls.transaction.push(operations);
      return Promise.all(operations);
    }) as unknown as MigrationRunWriterPrismaClient["$transaction"];
  }

  return { client, calls };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testUpsertSourceUsesCompoundUniqueKey() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationRunWriter(client);

  const source = await writer.upsertSource({
    adapterKey: "wordpress-db",
    sourceNamespace: "wordpress-db",
    sourceLabel: "WordPress DB",
  });

  assert.equal(source.adapterKey, "wordpress-db");
  assert.equal(calls.upsertSource.length, 1);
  const call = calls.upsertSource[0] as { where: Record<string, unknown>; create: Record<string, unknown> };
  assert.deepEqual(call.where, {
    adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: "wordpress-db" },
  });
  assert.equal(call.create.name, "WordPress DB");
}

async function testCreateRunCreatesDryRunRun() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationRunWriter(client);

  const run = await writer.createRun({ sourceId: "source-1", mode: "DRY_RUN", adapterVersion: "1.0.0" });

  assert.equal(run.mode, "DRY_RUN");
  assert.equal(calls.createRun.length, 1);
  const call = calls.createRun[0] as { data: Record<string, unknown> };
  assert.equal(call.data.status, "RUNNING");
  assert.equal(call.data.mode, "DRY_RUN");
  assert.ok(call.data.startedAt instanceof Date);
}

async function testCreateRecordsFromPlanCreatesOnePerItem() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationRunWriter(client);
  const plan = planFixture();

  const records = await writer.createRecordsFromPlan({ sourceId: "source-1", runId: "run-1", plan });

  assert.equal(records.length, 2);
  assert.equal(calls.createRecord.length, 2);

  const createCall = calls.createRecord.find(
    (c) => (c as { data: Record<string, unknown> }).data.sourceRecordKey === "wordpress-db:post:201",
  ) as { data: Record<string, unknown> };
  assert.equal(createCall.data.sourceStableKey, "wordpress-db:post:201");
  assert.equal(createCall.data.sourceHash, "hash-a");
  assert.equal(createCall.data.targetTypeHint, "ARTICLE");
  assert.equal(createCall.data.planAction, "CREATE");
  assert.equal(createCall.data.status, "PLANNED");
  assert.deepEqual(createCall.data.planSummary, { title: "Article One", slug: "article-one" });
  assert.deepEqual(createCall.data.validationSummary, [
    { code: "ARTICLE_MISSING_FEATURED_IMAGE", message: "no thumbnail", severity: "WARNING" },
  ]);

  const failCall = calls.createRecord.find(
    (c) => (c as { data: Record<string, unknown> }).data.sourceRecordKey === "wordpress-db:post:202",
  ) as { data: Record<string, unknown> };
  assert.equal(failCall.data.status, "FAILED");
  assert.equal(failCall.data.planAction, "FAIL");
  assert.equal(failCall.data.lastErrorCode, "NORMALIZE_FAILED");
  assert.equal(failCall.data.lastErrorMessage, "boom");
}

async function testRawAndNormalizedPayloadAlwaysJsonNull() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationRunWriter(client);
  await writer.createRecordsFromPlan({ sourceId: "source-1", runId: "run-1", plan: planFixture() });

  for (const call of calls.createRecord) {
    const data = (call as { data: Record<string, unknown> }).data;
    assert.equal(data.rawPayload, Prisma.JsonNull, "rawPayload must be Prisma.JsonNull, never real content");
    assert.equal(data.normalizedPayload, Prisma.JsonNull, "normalizedPayload must be Prisma.JsonNull");
  }
}

async function testCreateRecordsFromPlanUsesTransactionWhenAvailable() {
  const { client, calls } = createFakeClient({ withTransaction: true });
  const writer = new MigrationRunWriter(client);
  await writer.createRecordsFromPlan({ sourceId: "source-1", runId: "run-1", plan: planFixture() });

  assert.equal(calls.transaction.length, 1, "$transaction should be used exactly once, batching all creates");
}

async function testCreateRecordsFromPlanWorksWithoutTransaction() {
  const { client, calls } = createFakeClient({ withTransaction: false });
  const writer = new MigrationRunWriter(client);
  const records = await writer.createRecordsFromPlan({ sourceId: "source-1", runId: "run-1", plan: planFixture() });

  assert.equal(records.length, 2);
  assert.equal(calls.transaction.length, 0);
}

async function testPersistPlanCallsInOrderAndFinishesCompleted() {
  const { client, calls } = createFakeClient();
  const writer = new MigrationRunWriter(client);

  const result = await writer.persistPlan({
    adapterKey: "wordpress-db",
    sourceNamespace: "wordpress-db",
    plan: planFixture(),
  });

  assert.equal(calls.upsertSource.length, 1);
  assert.equal(calls.createRun.length, 1);
  assert.equal(calls.createRecord.length, 2);
  assert.equal(calls.updateRun.length, 1);

  const finishCall = calls.updateRun[0] as { data: Record<string, unknown> };
  assert.equal(finishCall.data.status, "COMPLETED");
  assert.equal(result.records.length, 2);
  assert.equal(result.source.adapterKey, "wordpress-db");
}

async function testPersistPlanFinishesFailedOnRecordCreationError() {
  const { client, calls } = createFakeClient({ failCreate: true });
  const writer = new MigrationRunWriter(client);

  await assert.rejects(() =>
    writer.persistPlan({
      adapterKey: "wordpress-db",
      sourceNamespace: "wordpress-db",
      plan: planFixture(),
    }),
  );

  assert.equal(calls.updateRun.length, 1);
  const finishCall = calls.updateRun[0] as { data: Record<string, unknown> };
  assert.equal(finishCall.data.status, "FAILED");
  assert.match(finishCall.data.errorMessage as string, /db unavailable/);
}

async function main() {
  await testUpsertSourceUsesCompoundUniqueKey();
  await testCreateRunCreatesDryRunRun();
  await testCreateRecordsFromPlanCreatesOnePerItem();
  await testRawAndNormalizedPayloadAlwaysJsonNull();
  await testCreateRecordsFromPlanUsesTransactionWhenAvailable();
  await testCreateRecordsFromPlanWorksWithoutTransaction();
  await testPersistPlanCallsInOrderAndFinishesCompleted();
  await testPersistPlanFinishesFailedOnRecordCreationError();
}

main()
  .then(() => {
    console.log("MigrationRunWriter tests: OK");
  })
  .catch((error) => {
    console.error("MigrationRunWriter tests: FAILED", error);
    process.exitCode = 1;
  });

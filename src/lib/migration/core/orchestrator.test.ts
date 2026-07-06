import assert from "node:assert/strict";

import type { MigrationLineage } from "@prisma/client";

import { registerMigrationAdapter } from "../adapters/registry";
import {
  PHASE_7_COMMIT_MODE_ERROR,
  createMigrationRunPlan,
  runMigrationCommit,
} from "./orchestrator";
import type { MigrationLineageLookup } from "./orchestrator";
import type { MigrationAdapter, NormalizedRecord, SourceRecordEnvelope } from "../types";

function envelope(fields: {
  sourceRecordKey: string;
  sourceEntityType: string;
  sourceHash?: string;
}): SourceRecordEnvelope {
  return {
    sourceEntityType: fields.sourceEntityType,
    sourceStableKey: fields.sourceRecordKey,
    sourceRecordKey: fields.sourceRecordKey,
    sourceHash: fields.sourceHash,
  };
}

function lineageRow(overrides: Partial<MigrationLineage> = {}): MigrationLineage {
  return {
    id: "lineage-1",
    sourceId: "source-1",
    recordId: null,
    runId: null,
    sourceEntityType: "mock:entity",
    sourceExternalId: null,
    sourceStableKey: "mock:1",
    sourceRecordKey: "mock:1",
    targetType: "ARTICLE",
    targetId: "target-1",
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

function createFakeLedger(lineageByKey: ReadonlyMap<string, MigrationLineage[]>) {
  const calls: { adapterKey: string; sourceNamespace: string; keys: readonly string[] }[] = [];
  const ledger: MigrationLineageLookup = {
    async findLineageBySourceRecordKeys(input) {
      calls.push(input);
      const result = new Map<string, MigrationLineage[]>();
      for (const key of input.keys) {
        const rows = lineageByKey.get(key);
        if (rows) result.set(key, rows);
      }
      return result;
    },
  };
  return { ledger, calls };
}

function registerMockAdapter(key: string, overrides: Partial<MigrationAdapter>): void {
  registerMigrationAdapter({
    metadata: {
      key,
      version: "test",
      displayName: `Mock adapter ${key}`,
      supportedSourceEntityTypes: ["mock:entity"],
      supportedTargetTypes: ["ARTICLE"],
      capabilities: ["DISCOVERY", "NORMALIZATION"],
      stableIdPolicy: "test",
      hashPolicy: "test",
      timezonePolicy: "UTC",
      deletionPolicy: "test",
    },
    ...overrides,
  });
}

async function testDiscoverAndNormalizeAreCalled() {
  const discoverCalls: unknown[] = [];
  const normalizeCalls: SourceRecordEnvelope[] = [];

  registerMockAdapter("mock-discover-normalize", {
    async discoverRecords(context) {
      discoverCalls.push(context);
      return [envelope({ sourceRecordKey: "mock:1", sourceEntityType: "mock:entity" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      normalizeCalls.push(record);
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: "Mock title", slug: "mock-slug" },
      };
    },
  });

  const plan = await createMigrationRunPlan({
    adapterKey: "mock-discover-normalize",
    sourceNamespace: "test",
  });

  assert.equal(discoverCalls.length, 1);
  assert.equal(normalizeCalls.length, 1);
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].action, "CREATE");
  assert.equal(plan.items[0].status, "PLANNED");
  assert.equal(plan.items[0].targetType, "ARTICLE");
  assert.equal(plan.items[0].summary?.title, "Mock title");
  assert.equal(plan.items[0].summary?.slug, "mock-slug");
}

async function testExplicitRecordsBypassDiscover() {
  let discoverCallCount = 0;
  registerMockAdapter("mock-explicit-records", {
    async discoverRecords() {
      discoverCallCount += 1;
      return [];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        normalizedPayload: {},
      };
    },
  });

  const plan = await createMigrationRunPlan({
    adapterKey: "mock-explicit-records",
    sourceNamespace: "test",
    records: [envelope({ sourceRecordKey: "explicit:1", sourceEntityType: "mock:entity" })],
  });

  assert.equal(discoverCallCount, 0);
  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].sourceRecordKey, "explicit:1");
}

async function testLimitAppliesPerEntityType() {
  registerMockAdapter("mock-limit", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "a:1", sourceEntityType: "type-a" }),
        envelope({ sourceRecordKey: "a:2", sourceEntityType: "type-a" }),
        envelope({ sourceRecordKey: "a:3", sourceEntityType: "type-a" }),
        envelope({ sourceRecordKey: "b:1", sourceEntityType: "type-b" }),
        envelope({ sourceRecordKey: "b:2", sourceEntityType: "type-b" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        normalizedPayload: {},
      };
    },
  });

  const plan = await createMigrationRunPlan({
    adapterKey: "mock-limit",
    sourceNamespace: "test",
    filters: { limit: 1 },
  });

  const typeAItems = plan.items.filter((item) => item.sourceEntityType === "type-a");
  const typeBItems = plan.items.filter((item) => item.sourceEntityType === "type-b");
  assert.equal(typeAItems.length, 1);
  assert.equal(typeBItems.length, 1);
}

async function testEntityTypesFilter() {
  registerMockAdapter("mock-entity-filter", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "a:1", sourceEntityType: "type-a" }),
        envelope({ sourceRecordKey: "b:1", sourceEntityType: "type-b" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        normalizedPayload: {},
      };
    },
  });

  const plan = await createMigrationRunPlan({
    adapterKey: "mock-entity-filter",
    sourceNamespace: "test",
    filters: { entityTypes: ["type-a"] },
  });

  assert.equal(plan.items.length, 1);
  assert.equal(plan.items[0].sourceEntityType, "type-a");
}

async function testNormalizeErrorDoesNotCrashRun() {
  registerMockAdapter("mock-partial-failure", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "ok:1", sourceEntityType: "mock:entity" }),
        envelope({ sourceRecordKey: "bad:1", sourceEntityType: "mock:entity" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      if (record.sourceRecordKey === "bad:1") {
        throw new Error("boom");
      }
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        normalizedPayload: {},
      };
    },
  });

  const plan = await createMigrationRunPlan({
    adapterKey: "mock-partial-failure",
    sourceNamespace: "test",
  });

  assert.equal(plan.items.length, 2);
  const okItem = plan.items.find((item) => item.sourceRecordKey === "ok:1");
  const badItem = plan.items.find((item) => item.sourceRecordKey === "bad:1");
  assert.equal(okItem?.action, "CREATE");
  assert.equal(badItem?.action, "FAIL");
  assert.equal(badItem?.status, "FAILED");
  assert.equal(plan.errors.length, 1);
  assert.equal(plan.errors[0].sourceRecordKey, "bad:1");
  assert.match(plan.errors[0].message, /boom/);
}

async function testWarningsPreservedOnItem() {
  registerMockAdapter("mock-warnings", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "warn:1", sourceEntityType: "mock:entity" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        normalizedPayload: {},
        warnings: [{ code: "MOCK_WARNING", message: "just a warning", severity: "WARNING" }],
      };
    },
  });

  const plan = await createMigrationRunPlan({
    adapterKey: "mock-warnings",
    sourceNamespace: "test",
  });

  assert.equal(plan.items[0].action, "CREATE");
  assert.equal(plan.items[0].warnings?.length, 1);
  assert.equal(plan.items[0].warnings?.[0].code, "MOCK_WARNING");
}

async function testExcludePastEventsProducesSkipPolicyItem() {
  registerMockAdapter("mock-past-events", {
    async discoverRecords() {
      return [
        {
          sourceEntityType: "mock:event",
          sourceStableKey: "event:past",
          sourceRecordKey: "event:past",
          metadata: { startsAt: "2000-01-01T00:00:00.000Z" },
        },
        {
          sourceEntityType: "mock:event",
          sourceStableKey: "event:future",
          sourceRecordKey: "event:future",
          metadata: { startsAt: "2999-01-01T00:00:00.000Z" },
        },
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        normalizedPayload: {},
      };
    },
  });

  const plan = await createMigrationRunPlan({
    adapterKey: "mock-past-events",
    sourceNamespace: "test",
    filters: { excludePastEvents: true },
    now: new Date("2026-01-01T00:00:00.000Z"),
  });

  const pastItem = plan.items.find((item) => item.sourceRecordKey === "event:past");
  const futureItem = plan.items.find((item) => item.sourceRecordKey === "event:future");
  assert.equal(pastItem?.action, "SKIP_POLICY");
  assert.equal(pastItem?.status, "SKIPPED");
  assert.equal(futureItem?.action, "CREATE");
}

async function testStatsPresentAndCorrect() {
  registerMockAdapter("mock-stats", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "article:1", sourceEntityType: "type-article" }),
        envelope({ sourceRecordKey: "article:2", sourceEntityType: "type-article" }),
        envelope({ sourceRecordKey: "place:1", sourceEntityType: "type-place" }),
        envelope({ sourceRecordKey: "bad:1", sourceEntityType: "type-place" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      if (record.sourceRecordKey === "bad:1") {
        throw new Error("boom");
      }
      const targetTypeHint = record.sourceEntityType === "type-article" ? "ARTICLE" : "PLACE";
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint,
        normalizedPayload: {},
        warnings:
          record.sourceRecordKey === "article:2"
            ? [{ code: "SOME_WARNING", message: "hi", severity: "WARNING" }]
            : [],
      };
    },
  });

  const plan = await createMigrationRunPlan({
    adapterKey: "mock-stats",
    sourceNamespace: "test",
  });

  assert.ok(plan.stats);
  const stats = plan.stats!;

  assert.equal(stats.discoveredCount, 4);
  assert.equal(stats.plannedCount, 4);
  assert.equal(stats.normalizedCount, 3);
  assert.equal(stats.failedCount, 1);
  assert.equal(stats.skippedCount, 0);
  assert.equal(stats.successRate, 3 / 4);

  assert.deepEqual(stats.actionCounts, { CREATE: 3, FAIL: 1 });
  assert.deepEqual(stats.statusCounts, { PLANNED: 3, FAILED: 1 });
  assert.deepEqual(stats.targetTypeCounts, { ARTICLE: 2, PLACE: 1 });
  assert.deepEqual(stats.sourceEntityTypeCounts, { "type-article": 2, "type-place": 2 });
  assert.deepEqual(stats.warningCounts, { SOME_WARNING: 1 });

  for (const value of Object.values(stats.durationsMs)) {
    assert.ok(value >= 0, `duration must be non-negative, got ${value}`);
  }
  assert.ok(stats.durationsMs.total >= stats.durationsMs.normalize);
}

async function testZeroRecordPlanDoesNotThrow() {
  registerMockAdapter("mock-empty", {
    async discoverRecords() {
      return [];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        normalizedPayload: {},
      };
    },
  });

  const plan = await createMigrationRunPlan({
    adapterKey: "mock-empty",
    sourceNamespace: "test",
  });

  assert.ok(plan.stats);
  const stats = plan.stats!;
  assert.equal(stats.discoveredCount, 0);
  assert.equal(stats.plannedCount, 0);
  assert.equal(stats.normalizedCount, 0);
  assert.equal(stats.successRate, 0);
  assert.deepEqual(stats.actionCounts, {});
  assert.deepEqual(stats.warningCounts, {});
  for (const value of Object.values(stats.durationsMs)) {
    assert.ok(value >= 0);
  }
}

async function testLedgerNoLineageIsCreate() {
  registerMockAdapter("mock-ledger-no-lineage", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "rec:1", sourceEntityType: "mock:entity", sourceHash: "hash-a" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: {},
      };
    },
  });

  const { ledger } = createFakeLedger(new Map());
  const plan = await createMigrationRunPlan({
    adapterKey: "mock-ledger-no-lineage",
    sourceNamespace: "test",
    ledger,
  });

  assert.equal(plan.items[0].action, "CREATE");
  assert.equal(plan.items[0].status, "PLANNED");
}

async function testLedgerSameHashIsSkipUnchanged() {
  registerMockAdapter("mock-ledger-same-hash", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "rec:1", sourceEntityType: "mock:entity", sourceHash: "hash-a" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: {},
      };
    },
  });

  const { ledger } = createFakeLedger(
    new Map([["rec:1", [lineageRow({ targetType: "ARTICLE", lastSourceHash: "hash-a" })]]]),
  );
  const plan = await createMigrationRunPlan({
    adapterKey: "mock-ledger-same-hash",
    sourceNamespace: "test",
    ledger,
  });

  assert.equal(plan.items[0].action, "SKIP_UNCHANGED");
  assert.equal(plan.items[0].status, "SKIPPED");
}

async function testLedgerDifferentHashIsUpdate() {
  registerMockAdapter("mock-ledger-diff-hash", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "rec:1", sourceEntityType: "mock:entity", sourceHash: "hash-b" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: {},
      };
    },
  });

  const { ledger } = createFakeLedger(
    new Map([["rec:1", [lineageRow({ targetType: "ARTICLE", lastSourceHash: "hash-a" })]]]),
  );
  const plan = await createMigrationRunPlan({
    adapterKey: "mock-ledger-diff-hash",
    sourceNamespace: "test",
    ledger,
  });

  assert.equal(plan.items[0].action, "UPDATE");
  assert.equal(plan.items[0].status, "PLANNED");
}

async function testLedgerWrongTargetTypeIsCreate() {
  registerMockAdapter("mock-ledger-wrong-type", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "rec:1", sourceEntityType: "mock:entity", sourceHash: "hash-a" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: {},
      };
    },
  });

  const { ledger } = createFakeLedger(
    new Map([["rec:1", [lineageRow({ targetType: "PLACE", lastSourceHash: "hash-a" })]]]),
  );
  const plan = await createMigrationRunPlan({
    adapterKey: "mock-ledger-wrong-type",
    sourceNamespace: "test",
    ledger,
  });

  assert.equal(plan.items[0].action, "CREATE");
}

async function testLedgerBatchLookupCalledOnce() {
  registerMockAdapter("mock-ledger-batch", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "rec:1", sourceEntityType: "mock:entity", sourceHash: "hash-a" }),
        envelope({ sourceRecordKey: "rec:2", sourceEntityType: "mock:entity", sourceHash: "hash-a" }),
        envelope({ sourceRecordKey: "rec:3", sourceEntityType: "mock:entity", sourceHash: "hash-a" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: {},
      };
    },
  });

  const { ledger, calls } = createFakeLedger(new Map());
  await createMigrationRunPlan({
    adapterKey: "mock-ledger-batch",
    sourceNamespace: "test",
    ledger,
  });

  assert.equal(calls.length, 1, "lineage lookup must be a single batch call, never N+1");
  assert.deepEqual([...calls[0].keys].sort(), ["rec:1", "rec:2", "rec:3"]);
}

async function testLedgerEmptyRecordsSkipsLookup() {
  registerMockAdapter("mock-ledger-empty", {
    async discoverRecords() {
      return [];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return { sourceRecordKey: record.sourceRecordKey, sourceEntityType: record.sourceEntityType, normalizedPayload: {} };
    },
  });

  const { ledger, calls } = createFakeLedger(new Map());
  await createMigrationRunPlan({
    adapterKey: "mock-ledger-empty",
    sourceNamespace: "test",
    ledger,
  });

  assert.equal(calls.length, 0, "an empty record set must never call the ledger");
}

async function testLedgerNormalizeFailureDoesNotBreakLineageLogic() {
  registerMockAdapter("mock-ledger-partial-failure", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "ok:1", sourceEntityType: "mock:entity", sourceHash: "hash-a" }),
        envelope({ sourceRecordKey: "bad:1", sourceEntityType: "mock:entity", sourceHash: "hash-a" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      if (record.sourceRecordKey === "bad:1") {
        throw new Error("boom");
      }
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: {},
      };
    },
  });

  const { ledger } = createFakeLedger(
    new Map([["ok:1", [lineageRow({ targetType: "ARTICLE", lastSourceHash: "hash-a" })]]]),
  );
  const plan = await createMigrationRunPlan({
    adapterKey: "mock-ledger-partial-failure",
    sourceNamespace: "test",
    ledger,
  });

  const okItem = plan.items.find((item) => item.sourceRecordKey === "ok:1");
  const badItem = plan.items.find((item) => item.sourceRecordKey === "bad:1");
  assert.equal(okItem?.action, "SKIP_UNCHANGED");
  assert.equal(badItem?.action, "FAIL");
  assert.equal(plan.errors.length, 1);
}

async function testLedgerStatsReflectCreateUpdateSkipUnchanged() {
  registerMockAdapter("mock-ledger-stats", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "create:1", sourceEntityType: "mock:entity", sourceHash: "hash-a" }),
        envelope({ sourceRecordKey: "update:1", sourceEntityType: "mock:entity", sourceHash: "hash-b" }),
        envelope({ sourceRecordKey: "skip:1", sourceEntityType: "mock:entity", sourceHash: "hash-a" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: {},
      };
    },
  });

  const { ledger } = createFakeLedger(
    new Map([
      ["update:1", [lineageRow({ targetType: "ARTICLE", lastSourceHash: "hash-a" })]],
      ["skip:1", [lineageRow({ targetType: "ARTICLE", lastSourceHash: "hash-a" })]],
    ]),
  );

  const plan = await createMigrationRunPlan({
    adapterKey: "mock-ledger-stats",
    sourceNamespace: "test",
    ledger,
  });

  assert.deepEqual(plan.stats!.actionCounts, { CREATE: 1, UPDATE: 1, SKIP_UNCHANGED: 1 });
  assert.deepEqual(plan.stats!.statusCounts, { PLANNED: 2, SKIPPED: 1 });
  assert.equal(plan.stats!.normalizedCount, 3);
  assert.equal(plan.stats!.failedCount, 0);
  assert.equal(plan.stats!.successRate, 1);
}

async function testCommitModeStillThrows() {
  await assert.rejects(
    () => runMigrationCommit(),
    (error) =>
      error instanceof Error && error.message === PHASE_7_COMMIT_MODE_ERROR,
  );
}

async function main() {
  await testDiscoverAndNormalizeAreCalled();
  await testExplicitRecordsBypassDiscover();
  await testLimitAppliesPerEntityType();
  await testEntityTypesFilter();
  await testNormalizeErrorDoesNotCrashRun();
  await testWarningsPreservedOnItem();
  await testExcludePastEventsProducesSkipPolicyItem();
  await testStatsPresentAndCorrect();
  await testZeroRecordPlanDoesNotThrow();
  await testLedgerNoLineageIsCreate();
  await testLedgerSameHashIsSkipUnchanged();
  await testLedgerDifferentHashIsUpdate();
  await testLedgerWrongTargetTypeIsCreate();
  await testLedgerBatchLookupCalledOnce();
  await testLedgerEmptyRecordsSkipsLookup();
  await testLedgerNormalizeFailureDoesNotBreakLineageLogic();
  await testLedgerStatsReflectCreateUpdateSkipUnchanged();
  await testCommitModeStillThrows();
}

main()
  .then(() => {
    console.log("migration orchestrator tests: OK");
  })
  .catch((error) => {
    console.error("migration orchestrator tests: FAILED", error);
    process.exitCode = 1;
  });

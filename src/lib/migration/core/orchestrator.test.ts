import assert from "node:assert/strict";

import { registerMigrationAdapter } from "../adapters/registry";
import {
  PHASE_7_COMMIT_MODE_ERROR,
  createMigrationRunPlan,
  runMigrationCommit,
} from "./orchestrator";
import type { MigrationAdapter, NormalizedRecord, SourceRecordEnvelope } from "../types";

function envelope(fields: {
  sourceRecordKey: string;
  sourceEntityType: string;
}): SourceRecordEnvelope {
  return {
    sourceEntityType: fields.sourceEntityType,
    sourceStableKey: fields.sourceRecordKey,
    sourceRecordKey: fields.sourceRecordKey,
  };
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

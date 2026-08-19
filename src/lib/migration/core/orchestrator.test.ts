import assert from "node:assert/strict";

import type { MigrationLineage } from "@prisma/client";

import { registerMigrationAdapter } from "../adapters/registry";
import {
  PHASE_7_COMMIT_MODE_ERROR,
  createMigrationRunExecutionPlan,
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

/**
 * The real wordpress-db adapter never sets `metadata.startsAt` (multi-date
 * Event schedules can't be reduced to one timestamp pre-normalize), so
 * `EVENT_PAST_ONLY_EXCLUDED` is a *post*-normalize warning `normalizeEvent()`
 * emits instead — this is the mechanism that actually protects a real
 * past-only WordPress Event (e.g. source id 49842) from being planned as
 * CREATE.
 */
async function testEventPastOnlyWarningProducesSkipPolicyItemWithoutExecutionCandidate() {
  registerMockAdapter("mock-past-only-warning", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "wordpress-db:events:49842", sourceEntityType: "wordpress-db:events" }),
        envelope({ sourceRecordKey: "wordpress-db:events:42041", sourceEntityType: "wordpress-db:events" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      if (record.sourceRecordKey === "wordpress-db:events:49842") {
        return {
          sourceRecordKey: record.sourceRecordKey,
          sourceEntityType: record.sourceEntityType,
          targetTypeHint: "ACTIVITY",
          normalizedPayload: { title: "Past-only event" },
          warnings: [
            {
              code: "EVENT_PAST_ONLY_EXCLUDED",
              message: "Every event_date session is in the past.",
              severity: "WARNING",
              sourceRecordKey: record.sourceRecordKey,
            },
          ],
        };
      }
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ACTIVITY",
        normalizedPayload: { title: "Active event" },
      };
    },
  });

  const executionPlan = await createMigrationRunExecutionPlan({
    adapterKey: "mock-past-only-warning",
    sourceNamespace: "test",
  });

  const pastOnlyItem = executionPlan.plan.items.find(
    (item) => item.sourceRecordKey === "wordpress-db:events:49842",
  );
  assert.equal(pastOnlyItem?.action, "SKIP_POLICY");
  assert.equal(pastOnlyItem?.status, "SKIPPED");
  assert.equal(pastOnlyItem?.summary?.reasonCode, "EVENT_PAST_ONLY_EXCLUDED");
  assert.ok(pastOnlyItem?.warnings?.some((w) => w.code === "EVENT_PAST_ONLY_EXCLUDED"));

  assert.ok(
    !executionPlan.executionCandidates.some(
      (candidate) => candidate.planItem.sourceRecordKey === "wordpress-db:events:49842",
    ),
    "a past-only excluded Event must never reach execution candidates (the commit runner must never be invoked for it)",
  );

  const activeItem = executionPlan.plan.items.find(
    (item) => item.sourceRecordKey === "wordpress-db:events:42041",
  );
  assert.equal(activeItem?.action, "CREATE");
  assert.ok(executionPlan.plan.stats);
  assert.equal(executionPlan.plan.stats!.actionCounts["SKIP_POLICY"], 1);
  assert.equal(executionPlan.plan.stats!.actionCounts["CREATE"], 1);
}

/**
 * Owner-approved exclusion of 28 legacy Offer post IDs: matched purely by
 * legacy WordPress post ID (never title/slug/fuzzy), short-circuits before
 * normalizeRecord() is even called, and must never produce an execution
 * candidate or count as an error. Uses two real excluded IDs (42237, 6147)
 * plus one non-excluded Offer to prove the check doesn't over-match.
 */
async function testOwnerExcludedLegacyOfferProducesSkipPolicyItemWithoutExecutionCandidate() {
  let normalizeCallCount = 0;
  registerMockAdapter("mock-owner-excluded-offers", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "wordpress-db:hb-programs:42237", sourceEntityType: "wordpress-db:hb-programs" }),
        envelope({ sourceRecordKey: "wordpress-db:services:6147", sourceEntityType: "wordpress-db:services" }),
        envelope({ sourceRecordKey: "wordpress-db:hb-programs:99999", sourceEntityType: "wordpress-db:hb-programs" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      normalizeCallCount += 1;
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "OFFER",
        normalizedPayload: { title: "Valid offer" },
      };
    },
  });

  const executionPlan = await createMigrationRunExecutionPlan({
    adapterKey: "mock-owner-excluded-offers",
    sourceNamespace: "test",
  });

  for (const excludedKey of ["wordpress-db:hb-programs:42237", "wordpress-db:services:6147"]) {
    const item = executionPlan.plan.items.find((i) => i.sourceRecordKey === excludedKey);
    assert.equal(item?.action, "SKIP_POLICY", `${excludedKey} must be SKIP_POLICY`);
    assert.equal(item?.status, "SKIPPED", `${excludedKey} must be SKIPPED`);
    assert.equal(item?.targetType, "OFFER");
    assert.equal(item?.summary?.reasonCode, "OWNER_EXCLUDED_LEGACY_OFFER");
    assert.ok(
      !executionPlan.executionCandidates.some((candidate) => candidate.planItem.sourceRecordKey === excludedKey),
      `${excludedKey} must never reach execution candidates (the commit runner must never be invoked for it)`,
    );
  }

  const validItem = executionPlan.plan.items.find(
    (item) => item.sourceRecordKey === "wordpress-db:hb-programs:99999",
  );
  assert.equal(validItem?.action, "CREATE", "a non-excluded Offer must still import normally");
  assert.ok(
    executionPlan.executionCandidates.some(
      (candidate) => candidate.planItem.sourceRecordKey === "wordpress-db:hb-programs:99999",
    ),
  );

  assert.equal(normalizeCallCount, 1, "normalizeRecord must never be called for an excluded record");
  assert.ok(executionPlan.plan.stats);
  assert.equal(executionPlan.plan.stats!.actionCounts["SKIP_POLICY"], 2);
  assert.equal(executionPlan.plan.stats!.actionCounts["CREATE"], 1);
  // SKIP_POLICY must never be counted as an error/failure — it's an
  // intentional, explained exclusion, not an unexplained missing record.
  assert.equal(executionPlan.plan.stats!.failedCount, 0);
  assert.equal(executionPlan.plan.errors.length, 0);
}

/**
 * The 28 excluded Offers were imported by a prior rerun, then manually
 * deleted from PROD by the owner — so a real rerun's lineage lookup may
 * still find an active MigrationLineage row pointing at a now-deleted
 * target for one of these keys. The exclusion must win regardless: never
 * resolve to UPDATE, never touch the lineage decision, and stay identical
 * across repeated runs (idempotent — an excluded Offer never "comes back").
 */
async function testOwnerExcludedLegacyOfferWinsOverStaleLineageAndIsIdempotentAcrossReruns() {
  const excludedKey = "wordpress-db:hb-programs:43089";
  registerMockAdapter("mock-owner-excluded-stale-lineage", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: excludedKey, sourceEntityType: "wordpress-db:hb-programs", sourceHash: "hash-v1" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "OFFER",
        normalizedPayload: { title: "Deleted-from-PROD legacy offer" },
      };
    },
  });

  const staleLedger: MigrationLineageLookup = {
    async findLineageBySourceRecordKeys() {
      return new Map([[excludedKey, [lineageRow({ sourceRecordKey: excludedKey, targetType: "OFFER", lastSourceHash: "hash-v1" })]]]);
    },
  };

  for (let run = 1; run <= 2; run += 1) {
    const executionPlan = await createMigrationRunExecutionPlan({
      adapterKey: "mock-owner-excluded-stale-lineage",
      sourceNamespace: "test",
      ledger: staleLedger,
    });
    const item = executionPlan.plan.items.find((i) => i.sourceRecordKey === excludedKey);
    assert.equal(item?.action, "SKIP_POLICY", `run ${run}: exclusion must win even with an active stale lineage row`);
    assert.equal(item?.status, "SKIPPED");
    assert.equal(item?.summary?.reasonCode, "OWNER_EXCLUDED_LEGACY_OFFER");
    assert.ok(!executionPlan.executionCandidates.some((c) => c.planItem.sourceRecordKey === excludedKey));
  }
}

/**
 * Owner-approved exclusion of legacy Event post ID 64586 (no `event_date`
 * postmeta, `MISSING_SCHEDULE`): matched purely by legacy WordPress post
 * ID, short-circuits before normalizeRecord() is even called, and must
 * never produce an execution candidate or count as an error. Event 64588
 * (imports fine under the existing tolerant-schedule fallback) is
 * deliberately included as a non-excluded control to prove the check
 * doesn't over-match.
 */
async function testOwnerExcludedLegacyEvent64586ProducesSkipPolicyItemWithoutExecutionCandidate() {
  let normalizeCallCount = 0;
  registerMockAdapter("mock-owner-excluded-events", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "wordpress-db:events:64586", sourceEntityType: "wordpress-db:events" }),
        envelope({ sourceRecordKey: "wordpress-db:events:64588", sourceEntityType: "wordpress-db:events" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      normalizeCallCount += 1;
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ACTIVITY",
        normalizedPayload: { title: "Valid event" },
      };
    },
  });

  const executionPlan = await createMigrationRunExecutionPlan({
    adapterKey: "mock-owner-excluded-events",
    sourceNamespace: "test",
  });

  const excludedItem = executionPlan.plan.items.find((i) => i.sourceRecordKey === "wordpress-db:events:64586");
  assert.equal(excludedItem?.action, "SKIP_POLICY");
  assert.equal(excludedItem?.status, "SKIPPED");
  assert.equal(excludedItem?.targetType, "ACTIVITY");
  assert.equal(excludedItem?.summary?.reasonCode, "OWNER_EXCLUDED_LEGACY_EVENT");
  assert.ok(
    !executionPlan.executionCandidates.some((candidate) => candidate.planItem.sourceRecordKey === "wordpress-db:events:64586"),
    "64586 must never reach execution candidates (the commit runner must never be invoked for it)",
  );

  const nonExcludedItem = executionPlan.plan.items.find((i) => i.sourceRecordKey === "wordpress-db:events:64588");
  assert.equal(nonExcludedItem?.action, "CREATE", "64588 must still import normally, never excluded");
  assert.ok(
    executionPlan.executionCandidates.some((candidate) => candidate.planItem.sourceRecordKey === "wordpress-db:events:64588"),
  );

  assert.equal(normalizeCallCount, 1, "normalizeRecord must never be called for the excluded 64586 record");
  assert.ok(executionPlan.plan.stats);
  assert.equal(executionPlan.plan.stats!.actionCounts["SKIP_POLICY"], 1);
  assert.equal(executionPlan.plan.stats!.actionCounts["CREATE"], 1);
  // SKIP_POLICY must never be counted as an error/failure — it's an
  // intentional, explained exclusion, not an unexplained missing record.
  assert.equal(executionPlan.plan.stats!.failedCount, 0);
  assert.equal(executionPlan.plan.errors.length, 0);
}

/**
 * If Event 64586 was ever imported by an earlier rerun, a real rerun's
 * lineage lookup may still find an active MigrationLineage row for it. The
 * exclusion must win regardless: never resolve to UPDATE, never touch the
 * lineage decision, and stay identical across repeated runs.
 */
async function testOwnerExcludedLegacyEvent64586WinsOverStaleLineageAndIsIdempotentAcrossReruns() {
  const excludedKey = "wordpress-db:events:64586";
  registerMockAdapter("mock-owner-excluded-event-stale-lineage", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: excludedKey, sourceEntityType: "wordpress-db:events", sourceHash: "hash-v1" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ACTIVITY",
        normalizedPayload: { title: "Legacy event with no schedule" },
      };
    },
  });

  const staleLedger: MigrationLineageLookup = {
    async findLineageBySourceRecordKeys() {
      return new Map([[excludedKey, [lineageRow({ sourceRecordKey: excludedKey, targetType: "ACTIVITY", lastSourceHash: "hash-v1" })]]]);
    },
  };

  for (let run = 1; run <= 2; run += 1) {
    const executionPlan = await createMigrationRunExecutionPlan({
      adapterKey: "mock-owner-excluded-event-stale-lineage",
      sourceNamespace: "test",
      ledger: staleLedger,
    });
    const item = executionPlan.plan.items.find((i) => i.sourceRecordKey === excludedKey);
    assert.equal(item?.action, "SKIP_POLICY", `run ${run}: exclusion must win even with an active stale lineage row`);
    assert.equal(item?.status, "SKIPPED");
    assert.equal(item?.summary?.reasonCode, "OWNER_EXCLUDED_LEGACY_EVENT");
    assert.ok(!executionPlan.executionCandidates.some((c) => c.planItem.sourceRecordKey === excludedKey));
  }
}

/**
 * Owner-approved exclusion of legacy Article post ID 46472 (empty, no
 * usable content — never artificially generated): matched purely by legacy
 * WordPress post ID, short-circuits before normalizeRecord() is even
 * called (so it never even reaches the generic MISSING_CONTENT fail-closed
 * validation), and must never produce an execution candidate or count as
 * an error. A neighboring, non-matching Article ID is included as a
 * non-excluded control to prove the check doesn't over-match, and behaves
 * exactly like an ordinary already-migrated Article (SKIP_UNCHANGED, via
 * an active lineage row with a matching hash).
 */
async function testOwnerExcludedLegacyArticle46472ProducesSkipPolicyItemWithoutExecutionCandidate() {
  let normalizeCallCount = 0;
  registerMockAdapter("mock-owner-excluded-articles", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "wordpress-db:post:46472", sourceEntityType: "wordpress-db:post" }),
        envelope({ sourceRecordKey: "wordpress-db:post:46473", sourceEntityType: "wordpress-db:post", sourceHash: "hash-v1" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      normalizeCallCount += 1;
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: "Valid article" },
      };
    },
  });

  const ledger: MigrationLineageLookup = {
    async findLineageBySourceRecordKeys() {
      return new Map([
        [
          "wordpress-db:post:46473",
          [lineageRow({ sourceRecordKey: "wordpress-db:post:46473", targetType: "ARTICLE", lastSourceHash: "hash-v1" })],
        ],
      ]);
    },
  };

  const executionPlan = await createMigrationRunExecutionPlan({
    adapterKey: "mock-owner-excluded-articles",
    sourceNamespace: "test",
    ledger,
  });

  const excludedItem = executionPlan.plan.items.find((i) => i.sourceRecordKey === "wordpress-db:post:46472");
  assert.equal(excludedItem?.action, "SKIP_POLICY");
  assert.equal(excludedItem?.status, "SKIPPED");
  assert.equal(excludedItem?.targetType, "ARTICLE");
  assert.equal(excludedItem?.summary?.reasonCode, "OWNER_EXCLUDED_LEGACY_ARTICLE");
  assert.ok(
    !executionPlan.executionCandidates.some((candidate) => candidate.planItem.sourceRecordKey === "wordpress-db:post:46472"),
    "46472 must never reach execution candidates (the commit runner must never be invoked for it)",
  );

  const nonExcludedItem = executionPlan.plan.items.find((i) => i.sourceRecordKey === "wordpress-db:post:46473");
  assert.equal(nonExcludedItem?.action, "SKIP_UNCHANGED", "an ordinary already-migrated Article must behave exactly as before — not excluded");

  assert.equal(normalizeCallCount, 1, "normalizeRecord must never be called for the excluded 46472 record");
  assert.ok(executionPlan.plan.stats);
  assert.equal(executionPlan.plan.stats!.actionCounts["SKIP_POLICY"], 1);
  assert.equal(executionPlan.plan.stats!.actionCounts["SKIP_UNCHANGED"], 1);
  // SKIP_POLICY must never be counted as an error/failure — it's an
  // intentional, explained exclusion, not an unexplained missing record.
  assert.equal(executionPlan.plan.stats!.failedCount, 0);
  assert.equal(executionPlan.plan.errors.length, 0);
}

/**
 * If Article 46472 was ever created by an earlier rerun (or a preview
 * mistakenly reported CREATE before this policy existed), a real rerun's
 * lineage lookup may still find an active MigrationLineage row for it. The
 * exclusion must win regardless — never resolve to UPDATE, never touch the
 * lineage decision — and stay identical (dry-run preview and commit alike)
 * across repeated runs.
 */
async function testOwnerExcludedLegacyArticle46472WinsOverStaleLineageAndIsIdempotentAcrossReruns() {
  const excludedKey = "wordpress-db:post:46472";
  registerMockAdapter("mock-owner-excluded-article-stale-lineage", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: excludedKey, sourceEntityType: "wordpress-db:post", sourceHash: "hash-v1" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: "Empty legacy article" },
      };
    },
  });

  const staleLedger: MigrationLineageLookup = {
    async findLineageBySourceRecordKeys() {
      return new Map([[excludedKey, [lineageRow({ sourceRecordKey: excludedKey, targetType: "ARTICLE", lastSourceHash: "hash-v1" })]]]);
    },
  };

  // Both a preview-only plan and a full execution plan must agree —
  // "dry-run и commit одинаково" — since both go through the same shared
  // runDiscoverNormalizeLoop().
  for (let run = 1; run <= 2; run += 1) {
    const plan = await createMigrationRunPlan({
      adapterKey: "mock-owner-excluded-article-stale-lineage",
      sourceNamespace: "test",
      ledger: staleLedger,
    });
    const previewItem = plan.items.find((i) => i.sourceRecordKey === excludedKey);
    assert.equal(previewItem?.action, "SKIP_POLICY", `run ${run} (preview): exclusion must win even with an active stale lineage row`);
    assert.equal(previewItem?.summary?.reasonCode, "OWNER_EXCLUDED_LEGACY_ARTICLE");

    const executionPlan = await createMigrationRunExecutionPlan({
      adapterKey: "mock-owner-excluded-article-stale-lineage",
      sourceNamespace: "test",
      ledger: staleLedger,
    });
    const item = executionPlan.plan.items.find((i) => i.sourceRecordKey === excludedKey);
    assert.equal(item?.action, "SKIP_POLICY", `run ${run} (commit): exclusion must win even with an active stale lineage row`);
    assert.equal(item?.status, "SKIPPED");
    assert.equal(item?.summary?.reasonCode, "OWNER_EXCLUDED_LEGACY_ARTICLE");
    assert.ok(!executionPlan.executionCandidates.some((c) => c.planItem.sourceRecordKey === excludedKey));
  }
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

/**
 * The exact real-world shape this fix targets: `wordpress-db:events:60404`'s
 * `scheduleDraft` has 6 boundary dates across 3 twelve-day ranges — the plan
 * item's `summary.sessionCount` must report the materialized 36, never the
 * raw `dates.length`.
 */
async function testEventPreviewFieldsReportMaterializedSessionCount() {
  registerMockAdapter("mock-event-session-count", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "wordpress-db:events:60404", sourceEntityType: "wordpress-db:events" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ACTIVITY",
        normalizedPayload: {
          title: "Актив Полис",
          scheduleDraft: {
            mode: "MULTI_DATE",
            dates: ["2026-07-20", "2026-07-31", "2026-08-01", "2026-08-12", "2026-08-13", "2026-08-24"],
            scheduleItems: [
              { date: "2026-07-20", dateEnd: "2026-07-31" },
              { date: "2026-08-01", dateEnd: "2026-08-12" },
              { date: "2026-08-13", dateEnd: "2026-08-24" },
            ],
          },
        },
      };
    },
  });

  const plan = await createMigrationRunPlan({ adapterKey: "mock-event-session-count", sourceNamespace: "test" });
  const item = plan.items.find((i) => i.sourceRecordKey === "wordpress-db:events:60404");

  assert.equal(item?.summary?.rawRangeCount, 3);
  assert.equal(item?.summary?.boundaryDateCount, 6);
  assert.equal(item?.summary?.sessionCount, 36, "must report the materialized daily count, not the 6 boundary dates");
  assert.equal(item?.summary?.firstSessionDate, "2026-07-20");
  assert.equal(item?.summary?.lastSessionDate, "2026-08-24");
}

/** A single-date (non-range) Event schedule is unaffected — the materialized count equals the one date, same as before this fix. */
async function testEventPreviewFieldsSingleDateUnchanged() {
  registerMockAdapter("mock-event-single-date", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "wordpress-db:events:56226", sourceEntityType: "wordpress-db:events" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ACTIVITY",
        normalizedPayload: {
          title: "Игра",
          scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-01"] },
        },
      };
    },
  });

  const plan = await createMigrationRunPlan({ adapterKey: "mock-event-single-date", sourceNamespace: "test" });
  const item = plan.items.find((i) => i.sourceRecordKey === "wordpress-db:events:56226");

  assert.equal(item?.summary?.sessionCount, 1);
  assert.equal(item?.summary?.rawRangeCount, 0);
  assert.equal(item?.summary?.boundaryDateCount, 1);
}

/** Non-Event (PLACE) items never get Event-only summary fields — mirrors Place fields never leaking onto ACTIVITY items. */
async function testEventPreviewFieldsAbsentForNonEventTargetType() {
  registerMockAdapter("mock-place-not-event", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "wordpress-db:places:1", sourceEntityType: "wordpress-db:places" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "PLACE",
        normalizedPayload: { title: "A place" },
      };
    },
  });

  const plan = await createMigrationRunPlan({ adapterKey: "mock-place-not-event", sourceNamespace: "test" });
  const item = plan.items.find((i) => i.sourceRecordKey === "wordpress-db:places:1");

  assert.equal(item?.summary?.sessionCount, undefined);
  assert.equal(item?.summary?.rawRangeCount, undefined);
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
  await testEventPastOnlyWarningProducesSkipPolicyItemWithoutExecutionCandidate();
  await testOwnerExcludedLegacyOfferProducesSkipPolicyItemWithoutExecutionCandidate();
  await testOwnerExcludedLegacyOfferWinsOverStaleLineageAndIsIdempotentAcrossReruns();
  await testOwnerExcludedLegacyEvent64586ProducesSkipPolicyItemWithoutExecutionCandidate();
  await testOwnerExcludedLegacyEvent64586WinsOverStaleLineageAndIsIdempotentAcrossReruns();
  await testOwnerExcludedLegacyArticle46472ProducesSkipPolicyItemWithoutExecutionCandidate();
  await testOwnerExcludedLegacyArticle46472WinsOverStaleLineageAndIsIdempotentAcrossReruns();
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
  await testEventPreviewFieldsReportMaterializedSessionCount();
  await testEventPreviewFieldsSingleDateUnchanged();
  await testEventPreviewFieldsAbsentForNonEventTargetType();
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

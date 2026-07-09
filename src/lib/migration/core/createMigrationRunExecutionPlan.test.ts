import assert from "node:assert/strict";

import type { MigrationLineage } from "@prisma/client";

import { registerMigrationAdapter } from "../adapters/registry";
import { createMigrationRunExecutionPlan, createMigrationRunPlan } from "./orchestrator";
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
  const ledger: MigrationLineageLookup = {
    async findLineageBySourceRecordKeys(input) {
      const result = new Map<string, MigrationLineage[]>();
      for (const key of input.keys) {
        const rows = lineageByKey.get(key);
        if (rows) result.set(key, rows);
      }
      return result;
    },
  };
  return { ledger };
}

function registerMockAdapter(key: string, overrides: Partial<MigrationAdapter>): void {
  registerMigrationAdapter({
    metadata: {
      key,
      version: "test",
      displayName: `Mock adapter ${key}`,
      supportedSourceEntityTypes: ["mock:entity"],
      supportedTargetTypes: ["ARTICLE", "PLACE", "ACTIVITY"],
      capabilities: ["DISCOVERY", "NORMALIZATION"],
      stableIdPolicy: "test",
      hashPolicy: "test",
      timezonePolicy: "UTC",
      deletionPolicy: "test",
    },
    ...overrides,
  });
}

// A deliberately rich candidate shape — richer than what
// `MigrationPlanItem.summary` (title/slug/ref counts) could ever carry, so
// tests can prove the *full* object survives, not just the summary.
interface FullPlaceCandidate {
  title: string;
  slug: string;
  phone: string | null;
  coordinates: { lat: number; lng: number } | null;
  rawMeta: Record<string, unknown>;
}

async function testExecutionPlanContainsOrdinaryMigrationPlan() {
  registerMockAdapter("exec-plan-basic", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "mock:1", sourceEntityType: "mock:entity" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: "Mock title", slug: "mock-slug" },
      };
    },
  });

  const result = await createMigrationRunExecutionPlan({
    adapterKey: "exec-plan-basic",
    sourceNamespace: "test",
  });

  assert.ok(result.plan);
  assert.equal(result.plan.adapterKey, "exec-plan-basic");
  assert.equal(result.plan.items.length, 1);
  assert.equal(result.plan.items[0].action, "CREATE");
  assert.equal(result.plan.items[0].summary?.title, "Mock title");
}

async function testExecutionCandidatesLengthMatchesPlanItemsWhenAllSucceed() {
  registerMockAdapter("exec-plan-length-match", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "mock:1", sourceEntityType: "mock:entity" }),
        envelope({ sourceRecordKey: "mock:2", sourceEntityType: "mock:entity" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: `Title ${record.sourceRecordKey}`, slug: "slug" },
      };
    },
  });

  const result = await createMigrationRunExecutionPlan({
    adapterKey: "exec-plan-length-match",
    sourceNamespace: "test",
  });

  assert.equal(result.plan.items.length, 2);
  assert.equal(result.executionCandidates.length, 2);
}

async function testEachExecutionCandidatePlanItemMatchesPlanItems() {
  registerMockAdapter("exec-plan-item-match", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "mock:1", sourceEntityType: "mock:entity" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: "Mock title", slug: "mock-slug" },
      };
    },
  });

  const result = await createMigrationRunExecutionPlan({
    adapterKey: "exec-plan-item-match",
    sourceNamespace: "test",
  });

  assert.deepEqual(result.executionCandidates[0].planItem, result.plan.items[0]);
}

async function testFullCandidateStoredNotJustSummary() {
  registerMockAdapter("exec-plan-full-candidate", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "mock:1", sourceEntityType: "mock:entity" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      const fullCandidate: FullPlaceCandidate = {
        title: "Cool Place",
        slug: "cool-place",
        phone: "+375291234567",
        coordinates: { lat: 53.9, lng: 27.5667 },
        rawMeta: { work_hours: ["Mon-Fri 9-18"] },
      };
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "PLACE",
        normalizedPayload: fullCandidate,
      };
    },
  });

  const result = await createMigrationRunExecutionPlan({
    adapterKey: "exec-plan-full-candidate",
    sourceNamespace: "test",
  });

  const candidate = result.executionCandidates[0].candidate as FullPlaceCandidate;
  assert.equal(candidate.phone, "+375291234567");
  assert.deepEqual(candidate.coordinates, { lat: 53.9, lng: 27.5667 });
  assert.deepEqual(candidate.rawMeta, { work_hours: ["Mon-Fri 9-18"] });
  // The plan item's own summary stays lossy — this is exactly the gap
  // MigrationExecutionCandidate exists to fix.
  assert.ok(!("phone" in (result.plan.items[0].summary ?? {})));
}

async function testPlaceShapedCandidateStored() {
  registerMockAdapter("exec-plan-place-shaped", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "wordpress-db:places:301", sourceEntityType: "mock:entity" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "PLACE",
        normalizedPayload: { title: "Cool Place", slug: "cool-place", cityRaw: "Minsk" },
      };
    },
  });

  const result = await createMigrationRunExecutionPlan({
    adapterKey: "exec-plan-place-shaped",
    sourceNamespace: "test",
  });

  assert.equal(result.plan.items[0].targetType, "PLACE");
  assert.deepEqual(result.executionCandidates[0].candidate, {
    title: "Cool Place",
    slug: "cool-place",
    cityRaw: "Minsk",
  });
}

async function testArticleShapedCandidateStored() {
  registerMockAdapter("exec-plan-article-shaped", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "wordpress-db:post:201", sourceEntityType: "mock:entity" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: "Hello Article", slug: "hello-article", hasElementorContent: false },
      };
    },
  });

  const result = await createMigrationRunExecutionPlan({
    adapterKey: "exec-plan-article-shaped",
    sourceNamespace: "test",
  });

  assert.equal(result.plan.items[0].targetType, "ARTICLE");
  assert.deepEqual(result.executionCandidates[0].candidate, {
    title: "Hello Article",
    slug: "hello-article",
    hasElementorContent: false,
  });
}

async function testEventShapedCandidateStoredViaFakeAdapter() {
  // The real `wordpress-db` adapter deliberately doesn't wire events yet
  // (see PR16) — this test proves the foundation itself is entity-agnostic
  // by registering a fake adapter that emits an event-shaped candidate,
  // without needing the real adapter wiring to exist.
  registerMockAdapter("exec-plan-event-shaped", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "wordpress-db:events:401", sourceEntityType: "mock:entity" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ACTIVITY",
        normalizedPayload: {
          title: "Kids Fest",
          slug: "kids-fest",
          scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-15T10:00:00.000Z"] },
        },
      };
    },
  });

  const result = await createMigrationRunExecutionPlan({
    adapterKey: "exec-plan-event-shaped",
    sourceNamespace: "test",
  });

  assert.equal(result.plan.items[0].targetType, "ACTIVITY");
  assert.deepEqual(result.executionCandidates[0].candidate, {
    title: "Kids Fest",
    slug: "kids-fest",
    scheduleDraft: { mode: "ONE_TIME", dates: ["2026-08-15T10:00:00.000Z"] },
  });
}

async function testLegacyCreateMigrationRunPlanBehaviorUnchanged() {
  registerMockAdapter("exec-plan-legacy-unchanged", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "mock:1", sourceEntityType: "mock:entity" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: "Mock title", slug: "mock-slug" },
      };
    },
  });

  const legacyPlan = await createMigrationRunPlan({
    adapterKey: "exec-plan-legacy-unchanged",
    sourceNamespace: "test",
  });

  // `createMigrationRunPlan()` must never expose executionCandidates or
  // any new field — its return type/shape is exactly `MigrationPlan`,
  // unchanged by the PR25 refactor.
  assert.ok(!("executionCandidates" in legacyPlan));
  assert.equal(legacyPlan.items.length, 1);
  assert.equal(legacyPlan.items[0].summary?.title, "Mock title");
  assert.deepEqual(
    new Set(Object.keys(legacyPlan)),
    new Set(["adapterKey", "adapterVersion", "sourceNamespace", "mode", "createdAt", "records", "items", "warnings", "errors", "stats"]),
  );
}

async function testSkipUnchangedItemsStillCaptureCandidate() {
  const lineageByKey = new Map<string, MigrationLineage[]>([
    ["mock:1", [lineageRow({ sourceRecordKey: "mock:1", lastSourceHash: "hash-a", targetType: "ARTICLE" })]],
  ]);
  const { ledger } = createFakeLedger(lineageByKey);

  registerMockAdapter("exec-plan-skip-unchanged", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "mock:1", sourceEntityType: "mock:entity", sourceHash: "hash-a" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: "Unchanged title", slug: "unchanged-slug" },
      };
    },
  });

  const result = await createMigrationRunExecutionPlan({
    adapterKey: "exec-plan-skip-unchanged",
    sourceNamespace: "test",
    ledger,
  });

  assert.equal(result.plan.items[0].action, "SKIP_UNCHANGED");
  assert.equal(result.executionCandidates.length, 1, "a SKIP_UNCHANGED item was still normalized, so it must keep its candidate");
  assert.deepEqual(result.executionCandidates[0].candidate, { title: "Unchanged title", slug: "unchanged-slug" });
}

async function testSkipPolicyAndFailedItemsNeverCaptureCandidate() {
  registerMockAdapter("exec-plan-skip-policy-and-fail", {
    async discoverRecords() {
      return [
        envelope({ sourceRecordKey: "mock:past-event", sourceEntityType: "mock:entity" }),
        envelope({ sourceRecordKey: "mock:broken", sourceEntityType: "mock:entity" }),
      ];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      if (record.sourceRecordKey === "mock:broken") {
        throw new Error("normalize failed on purpose");
      }
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: "Should not be reached for past-event", slug: "n/a" },
      };
    },
  });

  const result = await createMigrationRunExecutionPlan({
    adapterKey: "exec-plan-skip-policy-and-fail",
    sourceNamespace: "test",
    filters: { excludePastEvents: true },
    now: new Date("2026-01-01T00:00:00.000Z"),
    records: [
      {
        ...envelope({ sourceRecordKey: "mock:past-event", sourceEntityType: "mock:entity" }),
        metadata: { startsAt: new Date("2020-01-01T00:00:00.000Z") },
      },
      envelope({ sourceRecordKey: "mock:broken", sourceEntityType: "mock:entity" }),
    ],
  });

  const actions = result.plan.items.map((item) => item.action);
  assert.deepEqual(actions.sort(), ["FAIL", "SKIP_POLICY"]);
  assert.equal(result.executionCandidates.length, 0, "neither a policy-skipped nor a failed normalize has a candidate to keep");
}

async function testNormalizedPayloadStaysUnknownAtTypeLevel() {
  registerMockAdapter("exec-plan-unknown-type", {
    async discoverRecords() {
      return [envelope({ sourceRecordKey: "mock:1", sourceEntityType: "mock:entity" })];
    },
    async normalizeRecord(record): Promise<NormalizedRecord> {
      return {
        sourceRecordKey: record.sourceRecordKey,
        sourceEntityType: record.sourceEntityType,
        targetTypeHint: "ARTICLE",
        normalizedPayload: { title: "Mock title", slug: "mock-slug" },
      };
    },
  });

  const result = await createMigrationRunExecutionPlan({
    adapterKey: "exec-plan-unknown-type",
    sourceNamespace: "test",
  });

  // `MigrationExecutionCandidate["candidate"]` defaults to `unknown` — this
  // line only compiles because of the explicit cast below, proving the
  // foundation makes no entity-specific promise at the type level.
  const candidate = result.executionCandidates[0].candidate;
  const narrowed = candidate as { title: string; slug: string };
  assert.equal(narrowed.title, "Mock title");
}

async function main() {
  await testExecutionPlanContainsOrdinaryMigrationPlan();
  await testExecutionCandidatesLengthMatchesPlanItemsWhenAllSucceed();
  await testEachExecutionCandidatePlanItemMatchesPlanItems();
  await testFullCandidateStoredNotJustSummary();
  await testPlaceShapedCandidateStored();
  await testArticleShapedCandidateStored();
  await testEventShapedCandidateStoredViaFakeAdapter();
  await testLegacyCreateMigrationRunPlanBehaviorUnchanged();
  await testSkipUnchangedItemsStillCaptureCandidate();
  await testSkipPolicyAndFailedItemsNeverCaptureCandidate();
  await testNormalizedPayloadStaysUnknownAtTypeLevel();
}

main()
  .then(() => {
    console.log("createMigrationRunExecutionPlan tests: OK");
  })
  .catch((error) => {
    console.error("createMigrationRunExecutionPlan tests: FAILED", error);
    process.exitCode = 1;
  });

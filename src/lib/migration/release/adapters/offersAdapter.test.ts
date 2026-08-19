import assert from "node:assert/strict";

import { SequentialEntityPhaseAdapter } from "../adapter";
import { loadPhoenixReleaseManifest } from "../manifest";
import { buildOfferExecutionPolicyHashV1 } from "../../commit/offer/offerDomainHash";
import { OfferMediaSyncer } from "../../commit/offer/OfferMediaSyncer";
import {
  classifyDependencyReadiness,
  OffersPhaseExecutor,
  planOffersCreateAction,
  type OffersMigrationCandidate,
  type OffersMigrationDependencies,
  type OffersTargetLineageState,
} from "./offersAdapter";

const HASH_A = "offer-domain-v2:aaaa";
const HASH_B = "offer-domain-v2:bbbb";

function fixtureCandidate(overrides: Partial<OffersMigrationCandidate> = {}): OffersMigrationCandidate {
  return {
    sourceRecordKey: "wordpress-db:hb-programs:18932",
    domainHashV2: HASH_A,
    dependencyPlan: {
      placeSourceRecordKey: "wordpress-db:places:1",
      businessSourceKey: null,
      placeReadiness: "EXISTS_NOW",
      businessReadiness: null,
    },
    ...overrides,
  };
}

function cleanTarget(): OffersTargetLineageState {
  return { lineageCount: 0, targetExists: false, duplicateTarget: false, lineageDomainHash: null };
}

function rerunTarget(hash: string): OffersTargetLineageState {
  return { lineageCount: 1, targetExists: true, duplicateTarget: false, lineageDomainHash: hash };
}

// ---------------------------------------------------------------------------
// Committed real manifest scope check
// ---------------------------------------------------------------------------

function testRealManifestOffersScopeIsSixtyThreeAllCreate(): void {
  const manifestPath = "docs/migration/releases/phoenix-approved-2026-07-30.json";
  const { manifest } = loadPhoenixReleaseManifest(manifestPath);
  const offers = manifest.phases.find((p) => p.name === "offers")!;
  assert.equal(offers.records.length, 63);
  assert.equal(new Set(offers.records.map((r) => r.sourceRecordKey)).size, 63, "no duplicate Offer sourceRecordKey");
  assert(
    offers.records.every((r) => r.action === "CREATE"),
    "every committed Offers record must already be declared CREATE for a fresh target",
  );
  // A live clean DEV baseline (0 Offer/lineage rows for these 63 keys) has
  // since been proven, so the phase is BLOCKED for a different, real reason
  // now: OFFERS_EXECUTABLE_SOURCE_LOADER_MISSING — there is still no
  // reproducible raw WordPress loadCandidate source for these 63 records.
  assert.equal(offers.status, "BLOCKED");
  assert.equal(offers.blockerCode, "OFFERS_EXECUTABLE_SOURCE_LOADER_MISSING");
}

// ---------------------------------------------------------------------------
// planOffersCreateAction — pure idempotency planner
// ---------------------------------------------------------------------------

function testPlanCleanTargetIsCreate(): void {
  const plan = planOffersCreateAction(fixtureCandidate(), cleanTarget());
  assert.equal(plan.action, "CREATE");
  assert.equal(plan.reason, null);
}

function testPlanRerunMatchingHashIsSkipUnchanged(): void {
  const plan = planOffersCreateAction(fixtureCandidate({ domainHashV2: HASH_A }), rerunTarget(HASH_A));
  assert.equal(plan.action, "SKIP_UNCHANGED");
}

function testPlanTargetWithoutLineageIsConflict(): void {
  const target: OffersTargetLineageState = { lineageCount: 0, targetExists: true, duplicateTarget: false, lineageDomainHash: null };
  const plan = planOffersCreateAction(fixtureCandidate(), target);
  assert.equal(plan.action, "CONFLICT");
  assert.equal(plan.reason, "TARGET_WITHOUT_LINEAGE");
}

function testPlanLineageWithoutTargetIsConflict(): void {
  const target: OffersTargetLineageState = { lineageCount: 1, targetExists: false, duplicateTarget: false, lineageDomainHash: HASH_A };
  const plan = planOffersCreateAction(fixtureCandidate(), target);
  assert.equal(plan.action, "CONFLICT");
  assert.equal(plan.reason, "LINEAGE_WITHOUT_TARGET");
}

function testPlanChangedHashIsConflict(): void {
  const plan = planOffersCreateAction(fixtureCandidate({ domainHashV2: HASH_B }), rerunTarget(HASH_A));
  assert.equal(plan.action, "CONFLICT");
  assert.equal(plan.reason, "DOMAIN_HASH_CHANGED");
}

function testPlanDuplicateLineageIsFailed(): void {
  const target: OffersTargetLineageState = { lineageCount: 2, targetExists: true, duplicateTarget: false, lineageDomainHash: HASH_A };
  const plan = planOffersCreateAction(fixtureCandidate(), target);
  assert.equal(plan.action, "FAILED");
  assert.equal(plan.reason, "DUPLICATE_LINEAGE");
}

function testPlanAmbiguousTargetIsFailed(): void {
  const target: OffersTargetLineageState = { lineageCount: 0, targetExists: true, duplicateTarget: true, lineageDomainHash: null };
  const plan = planOffersCreateAction(fixtureCandidate(), target);
  assert.equal(plan.action, "FAILED");
  assert.equal(plan.reason, "DUPLICATE_TARGET");
}

// ---------------------------------------------------------------------------
// Clean-target / rerun simulation across the exact 63-record real scope
// ---------------------------------------------------------------------------

function testSixtyThreeRecordsAllPlanCreateOnCleanTarget(): void {
  const manifestPath = "docs/migration/releases/phoenix-approved-2026-07-30.json";
  const { manifest } = loadPhoenixReleaseManifest(manifestPath);
  const offers = manifest.phases.find((p) => p.name === "offers")!;
  const plans = offers.records.map((r) => planOffersCreateAction(fixtureCandidate({ sourceRecordKey: r.sourceRecordKey }), cleanTarget()));
  assert.equal(plans.filter((p) => p.action === "CREATE").length, 63);
  assert.equal(plans.filter((p) => p.action === "SKIP_UNCHANGED").length, 0);
  assert.equal(plans.filter((p) => p.action === "CONFLICT").length, 0);
  assert.equal(plans.filter((p) => p.action === "FAILED").length, 0);
}

function testSixtyThreeRecordsAllSkipUnchangedOnRerun(): void {
  const manifestPath = "docs/migration/releases/phoenix-approved-2026-07-30.json";
  const { manifest } = loadPhoenixReleaseManifest(manifestPath);
  const offers = manifest.phases.find((p) => p.name === "offers")!;
  const plans = offers.records.map((r) => {
    const candidate = fixtureCandidate({ sourceRecordKey: r.sourceRecordKey, domainHashV2: `offer-domain-v2:${r.sourceRecordKey}` });
    return planOffersCreateAction(candidate, rerunTarget(candidate.domainHashV2));
  });
  assert.equal(plans.filter((p) => p.action === "SKIP_UNCHANGED").length, 63);
  assert.equal(plans.filter((p) => p.action === "CREATE").length, 0);
  assert.equal(plans.filter((p) => p.action === "FAILED").length, 0);
  assert.equal(plans.filter((p) => p.action === "CONFLICT").length, 0);
}

// ---------------------------------------------------------------------------
// OffersPhaseExecutor
// ---------------------------------------------------------------------------

function fakeDeps(overrides: Partial<OffersMigrationDependencies> = {}): OffersMigrationDependencies {
  return {
    loadCandidate: (sourceRecordKey) => fixtureCandidate({ sourceRecordKey }),
    resolveTargetState: async () => cleanTarget(),
    resolveDependencies: async () => ({ placeId: "place-1", ownerUserId: "user-1", businessId: null, cityId: "city-1" }),
    write: async () => ({ targetId: "offer-1" }),
    ...overrides,
  };
}

async function testExecutorCreatesOnCleanTarget(): Promise<void> {
  let writeCalls = 0;
  const deps = fakeDeps({ write: async () => { writeCalls += 1; return { targetId: "offer-1" } } });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:hb-programs:18932", "CREATE");
  assert.equal(result.outcome, "CREATED");
  assert.equal(writeCalls, 1);
}

async function testExecutorSkipsUnchangedWithoutCallingWrite(): Promise<void> {
  const deps = fakeDeps({
    resolveTargetState: async () => rerunTarget(HASH_A),
    write: async () => { throw new Error("write must never be called for SKIP_UNCHANGED") },
  });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:hb-programs:18932", "SKIP_UNCHANGED");
  assert.equal(result.outcome, "SKIPPED");
}

async function testExecutorNeverPerformsUpdate(): Promise<void> {
  // The manifest's own expected-action vocabulary includes UPDATE, but this
  // executor must refuse it outright: there is no code path that can reach
  // `write()` except through a CREATE plan action.
  const deps = fakeDeps({ resolveTargetState: async () => rerunTarget(HASH_B) });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:hb-programs:18932", "UPDATE");
  assert.equal(result.outcome, "PROTECTED_CONFLICT", "a changed hash is a CONFLICT, never an UPDATE attempt");
}

async function testExecutorTargetWithoutLineageIsProtectedConflict(): Promise<void> {
  const deps = fakeDeps({
    resolveTargetState: async () => ({ lineageCount: 0, targetExists: true, duplicateTarget: false, lineageDomainHash: null }),
  });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:hb-programs:18932", "CREATE");
  assert.equal(result.outcome, "PROTECTED_CONFLICT");
  assert.equal(result.error, "TARGET_WITHOUT_LINEAGE");
}

async function testExecutorLineageWithoutTargetIsProtectedConflict(): Promise<void> {
  const deps = fakeDeps({
    resolveTargetState: async () => ({ lineageCount: 1, targetExists: false, duplicateTarget: false, lineageDomainHash: HASH_A }),
  });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:hb-programs:18932", "CREATE");
  assert.equal(result.outcome, "PROTECTED_CONFLICT");
  assert.equal(result.error, "LINEAGE_WITHOUT_TARGET");
}

async function testExecutorDuplicateLineageFailsClosed(): Promise<void> {
  const deps = fakeDeps({
    resolveTargetState: async () => ({ lineageCount: 2, targetExists: true, duplicateTarget: false, lineageDomainHash: HASH_A }),
  });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:hb-programs:18932", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "DUPLICATE_LINEAGE");
}

async function testExecutorAmbiguousTargetFailsClosed(): Promise<void> {
  const deps = fakeDeps({
    resolveTargetState: async () => ({ lineageCount: 0, targetExists: true, duplicateTarget: true, lineageDomainHash: null }),
  });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:hb-programs:18932", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "DUPLICATE_TARGET");
}

async function testExecutorZeroDependencyMatchesFailsClosed(): Promise<void> {
  const deps = fakeDeps({
    resolveDependencies: async () => { throw new Error("PLACE_DEPENDENCY_NOT_FOUND") },
    write: async () => { throw new Error("write must never be called when dependency resolution fails") },
  });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:hb-programs:18932", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "PLACE_DEPENDENCY_NOT_FOUND");
}

async function testExecutorAmbiguousDependencyMatchesFailsClosed(): Promise<void> {
  const deps = fakeDeps({
    resolveDependencies: async () => { throw new Error("PLACE_DEPENDENCY_AMBIGUOUS") },
    write: async () => { throw new Error("write must never be called when dependency resolution fails") },
  });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:hb-programs:18932", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "PLACE_DEPENDENCY_AMBIGUOUS");
}

async function testExecutorWrongOwnerRelationFailsClosed(): Promise<void> {
  const deps = fakeDeps({
    resolveDependencies: async () => { throw new Error("PLACE_OWNER_RELATION_MISMATCH") },
    write: async () => { throw new Error("write must never be called when dependency resolution fails") },
  });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:hb-programs:18932", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "PLACE_OWNER_RELATION_MISMATCH");
}

async function testExecutorRuntimeResolutionAlwaysCalledEvenWhenPlannedAsFuture(): Promise<void> {
  // Planning-time WILL_EXIST_AFTER_PREREQUISITE_PHASE must never be trusted
  // as a substitute for real resolution at write time.
  let resolveDependenciesCalls = 0;
  const candidate = fixtureCandidate({
    dependencyPlan: {
      placeSourceRecordKey: "wordpress-db:places:1",
      businessSourceKey: null,
      placeReadiness: "WILL_EXIST_AFTER_PREREQUISITE_PHASE",
      businessReadiness: null,
    },
  });
  const deps = fakeDeps({
    loadCandidate: () => candidate,
    resolveDependencies: async () => {
      resolveDependenciesCalls += 1;
      return { placeId: "place-1", ownerUserId: "user-1", businessId: null, cityId: "city-1" };
    },
  });
  const executor = new OffersPhaseExecutor(deps);
  const result = await executor.execute(candidate.sourceRecordKey, "CREATE");
  assert.equal(result.outcome, "CREATED");
  assert.equal(resolveDependenciesCalls, 1, "resolveDependencies must be invoked exactly once for a real CREATE, regardless of planning-time readiness");
}

async function testExecutorNeverCallsResolveDependenciesForSkipOrConflict(): Promise<void> {
  let resolveDependenciesCalls = 0;
  const deps = fakeDeps({
    resolveTargetState: async () => rerunTarget(HASH_A),
    resolveDependencies: async () => { resolveDependenciesCalls += 1; return { placeId: "place-1", ownerUserId: "user-1", businessId: null, cityId: "city-1" } },
  });
  const executor = new OffersPhaseExecutor(deps);
  await executor.execute("wordpress-db:hb-programs:18932", "SKIP_UNCHANGED");
  assert.equal(resolveDependenciesCalls, 0);
}

// ---------------------------------------------------------------------------
// classifyDependencyReadiness — planning-time dependency state
// ---------------------------------------------------------------------------

function testClassifyReadinessExistsNowWinsRegardlessOfPhaseStatus(): void {
  assert.equal(classifyDependencyReadiness({ prerequisitePhaseStatus: "BLOCKED", dependencyResolvableNow: true }), "EXISTS_NOW");
}

function testClassifyReadinessFutureRequiresReadyPrerequisite(): void {
  assert.equal(
    classifyDependencyReadiness({ prerequisitePhaseStatus: "READY", dependencyResolvableNow: false }),
    "WILL_EXIST_AFTER_PREREQUISITE_PHASE",
  );
}

function testClassifyReadinessRejectsUnresolvableAgainstBlockedPrerequisite(): void {
  assert.throws(
    () => classifyDependencyReadiness({ prerequisitePhaseStatus: "BLOCKED", dependencyResolvableNow: false }),
    /DEPENDENCY_PREREQUISITE_PHASE_NOT_READY/,
  );
}

// ---------------------------------------------------------------------------
// Sequential stop-on-first-error over Offers scope
// ---------------------------------------------------------------------------

async function testSequentialAdapterStopsAfterFirstFailureNoWritesAfter(): Promise<void> {
  const writesBySourceKey: string[] = [];
  const deps = fakeDeps({
    resolveTargetState: async (candidate) =>
      candidate.sourceRecordKey === "wordpress-db:hb-programs:2" ? { lineageCount: 2, targetExists: true, duplicateTarget: false, lineageDomainHash: HASH_A } : cleanTarget(),
    write: async (candidate) => {
      writesBySourceKey.push(candidate.sourceRecordKey);
      return { targetId: `offer-${candidate.sourceRecordKey}` };
    },
  });
  const executor = new OffersPhaseExecutor(deps);
  const adapter = new SequentialEntityPhaseAdapter(executor);
  const phase = {
    name: "offers" as const,
    status: "READY" as const,
    artifacts: [],
    records: [
      { sourceRecordKey: "wordpress-db:hb-programs:1", action: "CREATE" as const },
      { sourceRecordKey: "wordpress-db:hb-programs:2", action: "CREATE" as const },
      { sourceRecordKey: "wordpress-db:hb-programs:3", action: "CREATE" as const },
    ],
    protectedSourceRecordKeys: [],
    excludedSourceRecordKeys: [],
    deterministicConflicts: [],
    mediaPolicy: "METADATA" as const,
    prerequisites: [],
  };
  const results = await adapter.apply(phase);
  assert.equal(results.length, 2, "must stop immediately after the first FAILED record");
  assert.equal(results[0].outcome, "CREATED");
  assert.equal(results[1].outcome, "FAILED");
  assert.deepEqual(writesBySourceKey, ["wordpress-db:hb-programs:1"], "record 3 must never be written once record 2 fails");
}

// ---------------------------------------------------------------------------
// Hash / media independence (Step 6)
// ---------------------------------------------------------------------------

function testExecutionPolicyHashDiffersAcrossEnvironmentAndMediaPolicy(): void {
  const local = buildOfferExecutionPolicyHashV1({ environment: "LOCAL", mediaPolicy: "METADATA", binaryUploadAllowed: false, metadataOnly: true });
  const dev = buildOfferExecutionPolicyHashV1({ environment: "DEV", mediaPolicy: "METADATA", binaryUploadAllowed: false, metadataOnly: true });
  const devFull = buildOfferExecutionPolicyHashV1({ environment: "DEV", mediaPolicy: "FULL", binaryUploadAllowed: true, metadataOnly: false });
  assert.notEqual(local, dev, "execution-policy hash must vary by environment");
  assert.notEqual(dev, devFull, "execution-policy hash must vary by media policy");
}

async function testOfferMediaSyncerPerformsZeroBinaryWritesUnderMetadataPolicy(): Promise<void> {
  const syncer = new OfferMediaSyncer();
  const result = await syncer.sync({ offerId: "offer-1", ownerUserId: "user-1", attachmentIds: [101, 102], mediaPolicy: "METADATA", sourceRecordKey: "wordpress-db:hb-programs:18932" });
  assert.equal(result.status, "SKIPPED_POLICY");
  assert.equal(result.importedCount, 0);
}

async function main(): Promise<void> {
  testRealManifestOffersScopeIsSixtyThreeAllCreate();
  testPlanCleanTargetIsCreate();
  testPlanRerunMatchingHashIsSkipUnchanged();
  testPlanTargetWithoutLineageIsConflict();
  testPlanLineageWithoutTargetIsConflict();
  testPlanChangedHashIsConflict();
  testPlanDuplicateLineageIsFailed();
  testPlanAmbiguousTargetIsFailed();
  testSixtyThreeRecordsAllPlanCreateOnCleanTarget();
  testSixtyThreeRecordsAllSkipUnchangedOnRerun();
  await testExecutorCreatesOnCleanTarget();
  await testExecutorSkipsUnchangedWithoutCallingWrite();
  await testExecutorNeverPerformsUpdate();
  await testExecutorTargetWithoutLineageIsProtectedConflict();
  await testExecutorLineageWithoutTargetIsProtectedConflict();
  await testExecutorDuplicateLineageFailsClosed();
  await testExecutorAmbiguousTargetFailsClosed();
  await testExecutorZeroDependencyMatchesFailsClosed();
  await testExecutorAmbiguousDependencyMatchesFailsClosed();
  await testExecutorWrongOwnerRelationFailsClosed();
  await testExecutorRuntimeResolutionAlwaysCalledEvenWhenPlannedAsFuture();
  await testExecutorNeverCallsResolveDependenciesForSkipOrConflict();
  testClassifyReadinessExistsNowWinsRegardlessOfPhaseStatus();
  testClassifyReadinessFutureRequiresReadyPrerequisite();
  testClassifyReadinessRejectsUnresolvableAgainstBlockedPrerequisite();
  await testSequentialAdapterStopsAfterFirstFailureNoWritesAfter();
  testExecutionPolicyHashDiffersAcrossEnvironmentAndMediaPolicy();
  await testOfferMediaSyncerPerformsZeroBinaryWritesUnderMetadataPolicy();
  console.log("Phoenix Offers create-only adapter tests: PASS");
}

void main();

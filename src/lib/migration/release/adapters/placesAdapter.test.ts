import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SequentialEntityPhaseAdapter } from "../adapter";
import { planLineageOnlyCreateAction, type LineageOnlyTargetState } from "./lineageOnlyPlanner";
import { PlacesPhaseExecutor, type PlacesMigrationDependencies } from "./placesAdapter";

const HASH_A = "wordpress-db-domain-v2:aaaa";

function cleanTarget(): LineageOnlyTargetState {
  return { lineageCount: 0, targetExists: false, lineageDomainHash: null };
}
function rerunTarget(hash: string): LineageOnlyTargetState {
  return { lineageCount: 1, targetExists: true, lineageDomainHash: hash };
}

function testRealScopeArtifactIsSeventyEightUniqueRecords(): void {
  const artifact = JSON.parse(readFileSync("docs/migration/manifests/phoenix-places-dev-release-scope-2026-07-31.json", "utf8")) as {
    total: number;
    records: Array<{ sourceRecordKey: string; sourceHash: string | null }>;
  };
  assert.equal(artifact.total, 78);
  assert.equal(new Set(artifact.records.map((r) => r.sourceRecordKey)).size, 78);
  assert(artifact.records.every((r) => typeof r.sourceHash === "string" && r.sourceHash.startsWith("wordpress-db-domain-v2:")));
}

function testRealManifestPlacesDeclaresCreateForCleanDevTarget(): void {
  const manifest = JSON.parse(readFileSync("docs/migration/releases/phoenix-approved-2026-07-30.json", "utf8")) as {
    phases: Array<{ name: string; records: Array<{ action: string }> }>;
  };
  const places = manifest.phases.find((p) => p.name === "places")!;
  assert.equal(places.records.length, 78);
  assert(
    places.records.every((r) => r.action === "CREATE"),
    "clean DEV has never had Places written to it — SKIP_UNCHANGED would reflect stale LOCAL reconciliation, not this release's target",
  );
}

function testAllSeventyEightPlanCreateOnCleanTarget(): void {
  const artifact = JSON.parse(readFileSync("docs/migration/manifests/phoenix-places-dev-release-scope-2026-07-31.json", "utf8")) as {
    records: Array<{ sourceHash: string }>;
  };
  const plans = artifact.records.map((r) => planLineageOnlyCreateAction(r.sourceHash, cleanTarget()));
  assert.equal(plans.filter((p) => p.action === "CREATE").length, 78);
}

function fakeDeps(overrides: Partial<PlacesMigrationDependencies> = {}): PlacesMigrationDependencies {
  return {
    loadCandidate: (sourceRecordKey) => ({ sourceRecordKey, domainHash: HASH_A, dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:1" } }),
    resolveTargetState: async () => cleanTarget(),
    resolveDependencies: async () => ({ createdByUserId: "user-1" }),
    write: async () => ({ targetId: "place-1" }),
    ...overrides,
  };
}

async function testExecutorCreatesOnCleanTarget(): Promise<void> {
  let writeCalls = 0;
  const deps = fakeDeps({ write: async () => { writeCalls += 1; return { targetId: "place-1" } } });
  const result = await new PlacesPhaseExecutor(deps).execute("wordpress-db:places:1", "CREATE");
  assert.equal(result.outcome, "CREATED");
  assert.equal(writeCalls, 1);
}

async function testExecutorSkipsUnchangedWithoutCallingWrite(): Promise<void> {
  const deps = fakeDeps({ resolveTargetState: async () => rerunTarget(HASH_A), write: async () => { throw new Error("must not be called") } });
  const result = await new PlacesPhaseExecutor(deps).execute("wordpress-db:places:1", "SKIP_UNCHANGED");
  assert.equal(result.outcome, "SKIPPED");
}

async function testExecutorDuplicateLineageFailsClosed(): Promise<void> {
  const deps = fakeDeps({ resolveTargetState: async () => ({ lineageCount: 2, targetExists: true, lineageDomainHash: HASH_A }) });
  const result = await new PlacesPhaseExecutor(deps).execute("wordpress-db:places:1", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "DUPLICATE_LINEAGE");
}

async function testExecutorZeroOwnerDependencyFailsClosed(): Promise<void> {
  const deps = fakeDeps({ resolveDependencies: async () => { throw new Error("PLACE_OWNER_DEPENDENCY_NOT_FOUND") } });
  const result = await new PlacesPhaseExecutor(deps).execute("wordpress-db:places:1", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "PLACE_OWNER_DEPENDENCY_NOT_FOUND");
}

async function testSequentialAdapterStopsAfterFirstFailure(): Promise<void> {
  const writes: string[] = [];
  const deps = fakeDeps({
    resolveTargetState: async (candidate) => (candidate.sourceRecordKey === "wordpress-db:places:2" ? { lineageCount: 2, targetExists: true, lineageDomainHash: HASH_A } : cleanTarget()),
    write: async (candidate) => { writes.push(candidate.sourceRecordKey); return { targetId: `place-${candidate.sourceRecordKey}` } },
  });
  const adapter = new SequentialEntityPhaseAdapter(new PlacesPhaseExecutor(deps));
  const phase = {
    name: "places" as const, status: "READY" as const, artifacts: [],
    records: [
      { sourceRecordKey: "wordpress-db:places:1", action: "CREATE" as const },
      { sourceRecordKey: "wordpress-db:places:2", action: "CREATE" as const },
      { sourceRecordKey: "wordpress-db:places:3", action: "CREATE" as const },
    ],
    protectedSourceRecordKeys: [], excludedSourceRecordKeys: [], deterministicConflicts: [], mediaPolicy: "NONE" as const, prerequisites: [],
  };
  const results = await adapter.apply(phase);
  assert.equal(results.length, 2);
  assert.equal(results[1].outcome, "FAILED");
  assert.deepEqual(writes, ["wordpress-db:places:1"]);
}

async function main(): Promise<void> {
  testRealScopeArtifactIsSeventyEightUniqueRecords();
  testRealManifestPlacesDeclaresCreateForCleanDevTarget();
  testAllSeventyEightPlanCreateOnCleanTarget();
  await testExecutorCreatesOnCleanTarget();
  await testExecutorSkipsUnchangedWithoutCallingWrite();
  await testExecutorDuplicateLineageFailsClosed();
  await testExecutorZeroOwnerDependencyFailsClosed();
  await testSequentialAdapterStopsAfterFirstFailure();
  console.log("Phoenix Places adapter tests: PASS");
}

void main();

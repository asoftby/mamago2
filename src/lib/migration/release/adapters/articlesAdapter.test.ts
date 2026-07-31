import assert from "node:assert/strict";
import { SequentialEntityPhaseAdapter } from "../adapter";
import { readFileSync } from "node:fs";
import { planLineageOnlyCreateAction, type LineageOnlyTargetState } from "./lineageOnlyPlanner";
import { ArticlesPhaseExecutor, type ArticlesMigrationDependencies } from "./articlesAdapter";

const HASH_A = "wordpress-db-domain-v2:aaaa";
const HASH_B = "wordpress-db-domain-v2:bbbb";

function cleanTarget(): LineageOnlyTargetState {
  return { lineageCount: 0, targetExists: false, lineageDomainHash: null };
}
function rerunTarget(hash: string): LineageOnlyTargetState {
  return { lineageCount: 1, targetExists: true, lineageDomainHash: hash };
}

// ---------------------------------------------------------------------------
// Committed scope artifact — real file, no fakes
// ---------------------------------------------------------------------------

function testRealScopeArtifactIsTwentySixUniqueRecordsWithHashes(): void {
  const artifact = JSON.parse(readFileSync("docs/migration/manifests/phoenix-articles-dev-release-scope-2026-07-31.json", "utf8")) as {
    total: number;
    records: Array<{ sourceRecordKey: string; sourceHash: string | null }>;
  };
  assert.equal(artifact.total, 26);
  assert.equal(artifact.records.length, 26);
  assert.equal(new Set(artifact.records.map((r) => r.sourceRecordKey)).size, 26, "no duplicate sourceRecordKey");
  assert(artifact.records.every((r) => typeof r.sourceHash === "string" && r.sourceHash.startsWith("wordpress-db-domain-v2:")));
}

function testRealManifestArticlesIsReadyWithTwentySixCreateRecords(): void {
  const manifest = JSON.parse(readFileSync("docs/migration/releases/phoenix-approved-2026-07-30.json", "utf8")) as {
    phases: Array<{ name: string; status: string; artifacts: unknown[]; records: Array<{ action: string }>; blocker?: string }>;
  };
  const articles = manifest.phases.find((p) => p.name === "articles")!;
  assert.equal(articles.status, "READY", "the Articles vertical slice is proven end-to-end; the manifest must reflect that, not the earlier narrative-only blocker");
  assert.equal(articles.blocker, undefined);
  assert.equal(articles.artifacts.length, 1);
  assert.equal(articles.records.length, 26);
  assert(articles.records.every((r) => r.action === "CREATE"), "clean DEV has never had Article rows written to it");
}

// ---------------------------------------------------------------------------
// planLineageOnlyCreateAction
// ---------------------------------------------------------------------------

function testPlanCleanTargetIsCreate(): void {
  assert.deepEqual(planLineageOnlyCreateAction(HASH_A, cleanTarget()), { action: "CREATE", reason: null });
}
function testPlanRerunMatchingHashIsSkipUnchanged(): void {
  assert.deepEqual(planLineageOnlyCreateAction(HASH_A, rerunTarget(HASH_A)), { action: "SKIP_UNCHANGED", reason: null });
}
function testPlanLineageWithoutTargetIsConflict(): void {
  const target: LineageOnlyTargetState = { lineageCount: 1, targetExists: false, lineageDomainHash: HASH_A };
  assert.deepEqual(planLineageOnlyCreateAction(HASH_A, target), { action: "CONFLICT", reason: "LINEAGE_WITHOUT_TARGET" });
}
function testPlanChangedHashIsConflict(): void {
  assert.deepEqual(planLineageOnlyCreateAction(HASH_B, rerunTarget(HASH_A)), { action: "CONFLICT", reason: "DOMAIN_HASH_CHANGED" });
}
function testPlanDuplicateLineageIsFailed(): void {
  const target: LineageOnlyTargetState = { lineageCount: 2, targetExists: true, lineageDomainHash: HASH_A };
  assert.deepEqual(planLineageOnlyCreateAction(HASH_A, target), { action: "FAILED", reason: "DUPLICATE_LINEAGE" });
}

function testAllTwentySixPlanCreateOnCleanTarget(): void {
  const artifact = JSON.parse(readFileSync("docs/migration/manifests/phoenix-articles-dev-release-scope-2026-07-31.json", "utf8")) as {
    records: Array<{ sourceRecordKey: string; sourceHash: string }>;
  };
  const plans = artifact.records.map((r) => planLineageOnlyCreateAction(r.sourceHash, cleanTarget()));
  assert.equal(plans.filter((p) => p.action === "CREATE").length, 26);
  assert.equal(plans.filter((p) => p.action !== "CREATE").length, 0);
}
function testAllTwentySixSkipUnchangedOnRerun(): void {
  const artifact = JSON.parse(readFileSync("docs/migration/manifests/phoenix-articles-dev-release-scope-2026-07-31.json", "utf8")) as {
    records: Array<{ sourceRecordKey: string; sourceHash: string }>;
  };
  const plans = artifact.records.map((r) => planLineageOnlyCreateAction(r.sourceHash, rerunTarget(r.sourceHash)));
  assert.equal(plans.filter((p) => p.action === "SKIP_UNCHANGED").length, 26);
  assert.equal(plans.filter((p) => p.action !== "SKIP_UNCHANGED").length, 0);
}

// ---------------------------------------------------------------------------
// ArticlesPhaseExecutor
// ---------------------------------------------------------------------------

function fakeDeps(overrides: Partial<ArticlesMigrationDependencies> = {}): ArticlesMigrationDependencies {
  return {
    loadCandidate: (sourceRecordKey) => ({ sourceRecordKey, domainHash: HASH_A }),
    resolveTargetState: async () => cleanTarget(),
    write: async () => ({ targetId: "article-1" }),
    ...overrides,
  };
}

async function testExecutorCreatesOnCleanTarget(): Promise<void> {
  let writeCalls = 0;
  const deps = fakeDeps({ write: async () => { writeCalls += 1; return { targetId: "article-1" } } });
  const result = await new ArticlesPhaseExecutor(deps).execute("wordpress-db:post:1", "CREATE");
  assert.equal(result.outcome, "CREATED");
  assert.equal(writeCalls, 1);
}

async function testExecutorSkipsUnchangedWithoutCallingWrite(): Promise<void> {
  const deps = fakeDeps({
    resolveTargetState: async () => rerunTarget(HASH_A),
    write: async () => { throw new Error("write must never be called for SKIP_UNCHANGED") },
  });
  const result = await new ArticlesPhaseExecutor(deps).execute("wordpress-db:post:1", "SKIP_UNCHANGED");
  assert.equal(result.outcome, "SKIPPED");
}

async function testExecutorNeverPerformsUpdate(): Promise<void> {
  const deps = fakeDeps({ resolveTargetState: async () => rerunTarget(HASH_B) });
  const result = await new ArticlesPhaseExecutor(deps).execute("wordpress-db:post:1", "UPDATE");
  assert.equal(result.outcome, "PROTECTED_CONFLICT", "a changed hash is CONFLICT, never an UPDATE attempt");
}

async function testExecutorDuplicateLineageFailsClosed(): Promise<void> {
  const deps = fakeDeps({ resolveTargetState: async () => ({ lineageCount: 2, targetExists: true, lineageDomainHash: HASH_A }) });
  const result = await new ArticlesPhaseExecutor(deps).execute("wordpress-db:post:1", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "DUPLICATE_LINEAGE");
}

async function testSequentialAdapterStopsAfterFirstFailure(): Promise<void> {
  const writes: string[] = [];
  const deps = fakeDeps({
    resolveTargetState: async (candidate) =>
      candidate.sourceRecordKey === "wordpress-db:post:2" ? { lineageCount: 2, targetExists: true, lineageDomainHash: HASH_A } : cleanTarget(),
    loadCandidate: (sourceRecordKey) => ({ sourceRecordKey, domainHash: HASH_A }),
    write: async (candidate) => { writes.push(candidate.sourceRecordKey); return { targetId: `article-${candidate.sourceRecordKey}` } },
  });
  const adapter = new SequentialEntityPhaseAdapter(new ArticlesPhaseExecutor(deps));
  const phase = {
    name: "articles" as const,
    status: "READY" as const,
    artifacts: [],
    records: [
      { sourceRecordKey: "wordpress-db:post:1", action: "CREATE" as const },
      { sourceRecordKey: "wordpress-db:post:2", action: "CREATE" as const },
      { sourceRecordKey: "wordpress-db:post:3", action: "CREATE" as const },
    ],
    protectedSourceRecordKeys: [],
    excludedSourceRecordKeys: [],
    deterministicConflicts: [],
    mediaPolicy: "NONE" as const,
    prerequisites: [],
  };
  const results = await adapter.apply(phase);
  assert.equal(results.length, 2, "must stop immediately after the first FAILED record");
  assert.equal(results[1].outcome, "FAILED");
  assert.deepEqual(writes, ["wordpress-db:post:1"], "record 3 must never be written once record 2 fails");
}

async function main(): Promise<void> {
  testRealScopeArtifactIsTwentySixUniqueRecordsWithHashes();
  testRealManifestArticlesIsReadyWithTwentySixCreateRecords();
  testPlanCleanTargetIsCreate();
  testPlanRerunMatchingHashIsSkipUnchanged();
  testPlanLineageWithoutTargetIsConflict();
  testPlanChangedHashIsConflict();
  testPlanDuplicateLineageIsFailed();
  testAllTwentySixPlanCreateOnCleanTarget();
  testAllTwentySixSkipUnchangedOnRerun();
  await testExecutorCreatesOnCleanTarget();
  await testExecutorSkipsUnchangedWithoutCallingWrite();
  await testExecutorNeverPerformsUpdate();
  await testExecutorDuplicateLineageFailsClosed();
  await testSequentialAdapterStopsAfterFirstFailure();
  console.log("Phoenix Articles adapter tests: PASS");
}

void main();

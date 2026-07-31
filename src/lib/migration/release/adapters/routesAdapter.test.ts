import assert from "node:assert/strict";
import { SequentialEntityPhaseAdapter } from "../adapter";
import { planRoutesCreateAction, RoutesPhaseExecutor, type RoutesMigrationDependencies } from "./routesAdapter";
import { readFileSync } from "node:fs";
const hash = "hash"; const clean = { lineageCount: 0, targetCount: 0, lineageTargetExists: false, lineageDomainHash: null };
function deps(overrides: Partial<RoutesMigrationDependencies> = {}): RoutesMigrationDependencies { return { loadCandidate: (sourceRecordKey) => ({ sourceRecordKey, domainHash: hash, slug: sourceRecordKey }), resolveTargetState: async () => clean, write: async () => ({ targetId: "r" }), ...overrides }; }
async function main() {
  const scope = JSON.parse(readFileSync("docs/migration/manifests/phoenix-routes-dev-release-scope-2026-07-31.json", "utf8")) as { total: number; records: Array<{ sourceRecordKey: string; sourceHash: string }> };
  assert.equal(scope.total, 14); assert.equal(scope.records.length, 14); assert.equal(new Set(scope.records.map((r) => r.sourceRecordKey)).size, 14); assert(scope.records.every((r) => planRoutesCreateAction(r.sourceHash, clean).action === "CREATE"));
  assert.equal(planRoutesCreateAction(hash, clean).action, "CREATE");
  assert.equal(planRoutesCreateAction(hash, { ...clean, targetCount: 1 }).reason, "TARGET_WITHOUT_LINEAGE");
  assert.equal(planRoutesCreateAction(hash, { lineageCount: 1, targetCount: 1, lineageTargetExists: true, lineageDomainHash: hash }).action, "SKIP_UNCHANGED");
  assert.equal(planRoutesCreateAction(hash, { lineageCount: 1, targetCount: 0, lineageTargetExists: false, lineageDomainHash: hash }).reason, "LINEAGE_WITHOUT_TARGET");
  assert.equal(planRoutesCreateAction(hash, { lineageCount: 1, targetCount: 1, lineageTargetExists: true, lineageDomainHash: "other" }).reason, "HASH_MISMATCH");
  assert.equal(planRoutesCreateAction(hash, { ...clean, lineageCount: 2 }).reason, "DUPLICATE_LINEAGE");
  assert.equal(planRoutesCreateAction(hash, { ...clean, targetCount: 2 }).reason, "DUPLICATE_TARGET");
  const writes: string[] = [];
  const adapter = new SequentialEntityPhaseAdapter(new RoutesPhaseExecutor(deps({ resolveTargetState: async (c) => c.sourceRecordKey === "r2" ? { ...clean, lineageCount: 2 } : clean, write: async (c) => { writes.push(c.sourceRecordKey); return { targetId: c.slug }; } })));
  const results = await adapter.apply({ name: "routes", status: "READY", artifacts: [], records: ["r1", "r2", "r3"].map(sourceRecordKey => ({ sourceRecordKey, action: "CREATE" as const })), protectedSourceRecordKeys: [], excludedSourceRecordKeys: [], deterministicConflicts: [], mediaPolicy: "NONE", prerequisites: [] });
  assert.equal(results.length, 2); assert.deepEqual(writes, ["r1"]);
  console.log("Phoenix Routes adapter tests: PASS");
}
void main();

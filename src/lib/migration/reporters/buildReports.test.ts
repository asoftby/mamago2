import assert from "node:assert/strict";

import { buildHumanReport, buildMachineReport } from "./buildReports";
import type { MigrationPlan } from "../types";

function basePlan(overrides: Partial<MigrationPlan> = {}): MigrationPlan {
  return {
    adapterKey: "test-adapter",
    adapterVersion: "1.0.0",
    sourceNamespace: "test",
    mode: "DRY_RUN",
    createdAt: new Date().toISOString(),
    records: [
      { sourceEntityType: "type-a", sourceStableKey: "a:1", sourceRecordKey: "a:1" },
      { sourceEntityType: "type-a", sourceStableKey: "a:2", sourceRecordKey: "a:2" },
    ],
    items: [
      { sourceRecordKey: "a:1", sourceEntityType: "type-a", action: "CREATE", status: "PLANNED" },
      { sourceRecordKey: "a:2", sourceEntityType: "type-a", action: "FAIL", status: "FAILED" },
    ],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function testFallbackWithoutStats() {
  // A hand-built plan predating `stats` (e.g. an older caller/test) must
  // still summarize correctly from records/items directly.
  const plan = basePlan();
  assert.equal(plan.stats, undefined);

  const machineReport = buildMachineReport(plan);
  assert.equal(machineReport.summary.totalRecords, 2);
  assert.equal(machineReport.summary.plannedItems, 2);

  const humanReport = buildHumanReport(plan);
  assert.match(humanReport.content!, /Records: 2/);
  assert.match(humanReport.content!, /Planned items: 2/);
}

function testUsesStatsWhenPresent() {
  const plan = basePlan({
    stats: {
      discoveredCount: 5,
      plannedCount: 5,
      normalizedCount: 4,
      failedCount: 1,
      skippedCount: 0,
      successRate: 0.8,
      actionCounts: { CREATE: 4, FAIL: 1 },
      statusCounts: { PLANNED: 4, FAILED: 1 },
      targetTypeCounts: {},
      sourceEntityTypeCounts: { "type-a": 5 },
      warningCounts: {},
      durationsMs: { discover: 1, filter: 1, normalize: 1, plan: 1, total: 4 },
    },
  });

  // Deliberately mismatched from records/items.length to prove stats wins.
  const machineReport = buildMachineReport(plan);
  assert.equal(machineReport.summary.totalRecords, 5);
  assert.equal(machineReport.summary.plannedItems, 5);

  const humanReport = buildHumanReport(plan);
  assert.match(humanReport.content!, /Records: 5/);
  assert.match(humanReport.content!, /Planned items: 5/);
}

function main() {
  testFallbackWithoutStats();
  testUsesStatsWhenPresent();
}

main();
console.log("migration buildReports tests: OK");

import type { MigrationPlan, MigrationReport, MigrationReportSummary } from "../types";

/**
 * `plan.stats` (added in Phase 4 / PR5.5) already carries `discoveredCount`/
 * `plannedCount` computed once by the engine — reuse them here instead of
 * recomputing from `plan.records`/`plan.items` directly. Falls back to the
 * original computation for a hand-built `MigrationPlan` that predates
 * `stats` (e.g. older tests), so this stays backward-compatible.
 */
function summarizePlan(plan: MigrationPlan): MigrationReportSummary {
  return {
    totalRecords: plan.stats?.discoveredCount ?? plan.records.length,
    plannedItems: plan.stats?.plannedCount ?? plan.items.length,
    warningCount:
      plan.warnings.length +
      plan.items.reduce((count, item) => count + (item.warnings?.length ?? 0), 0),
    errorCount:
      plan.errors.length +
      plan.items.reduce((count, item) => count + (item.errors?.length ?? 0), 0),
    blockedItems: plan.items.filter(
      (item) => item.action === "QUARANTINE" || item.status === "QUARANTINED",
    ).length,
  };
}

export function buildMachineReport(plan: MigrationPlan): MigrationReport {
  return {
    type: "MACHINE",
    generatedAt: new Date().toISOString(),
    adapterKey: plan.adapterKey,
    sourceNamespace: plan.sourceNamespace,
    runMode: plan.mode,
    summary: summarizePlan(plan),
    warnings: plan.warnings,
    errors: plan.errors,
    plan,
  };
}

export function buildHumanReport(plan: MigrationPlan): MigrationReport {
  const summary = summarizePlan(plan);
  const content = [
    `Migration dry-run report for ${plan.adapterKey}/${plan.sourceNamespace}`,
    `Records: ${summary.totalRecords}`,
    `Planned items: ${summary.plannedItems}`,
    `Warnings: ${summary.warningCount}`,
    `Errors: ${summary.errorCount}`,
    `Blocked items: ${summary.blockedItems}`,
  ].join("\n");

  return {
    type: "HUMAN",
    generatedAt: new Date().toISOString(),
    adapterKey: plan.adapterKey,
    sourceNamespace: plan.sourceNamespace,
    runMode: plan.mode,
    summary,
    warnings: plan.warnings,
    errors: plan.errors,
    content,
  };
}

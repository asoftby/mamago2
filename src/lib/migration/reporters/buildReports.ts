import type { MigrationPlan, MigrationReport, MigrationReportSummary } from "../types";

function summarizePlan(plan: MigrationPlan): MigrationReportSummary {
  return {
    totalRecords: plan.records.length,
    plannedItems: plan.items.length,
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

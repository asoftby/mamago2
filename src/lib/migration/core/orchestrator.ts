import { getMigrationAdapter } from "../adapters/registry";
import { buildHumanReport, buildMachineReport } from "../reporters/buildReports";
import type { MigrationPlan, MigrationReport, SourceRecordEnvelope } from "../types";

export const PHASE_7_COMMIT_MODE_ERROR =
  "Commit mode is not implemented in Phase 7";

export interface MigrationRunPlanInput {
  adapterKey: string;
  sourceNamespace: string;
  records?: readonly SourceRecordEnvelope[];
  now?: Date;
}

export interface MigrationDryRunResult {
  plan: MigrationPlan;
  reports: {
    machine: MigrationReport;
    human: MigrationReport;
  };
}

export async function createMigrationRunPlan(
  input: MigrationRunPlanInput,
): Promise<MigrationPlan> {
  const adapter = getMigrationAdapter(input.adapterKey);

  if (!adapter) {
    throw new Error(`Migration adapter "${input.adapterKey}" is not registered`);
  }

  return {
    adapterKey: adapter.metadata.key,
    adapterVersion: adapter.metadata.version,
    sourceNamespace: input.sourceNamespace,
    mode: "DRY_RUN",
    createdAt: (input.now ?? new Date()).toISOString(),
    records: input.records ?? [],
    items: [],
    warnings: [],
    errors: [],
  };
}

export async function runMigrationDryRun(
  input: MigrationRunPlanInput,
): Promise<MigrationDryRunResult> {
  const plan = await createMigrationRunPlan(input);

  return {
    plan,
    reports: {
      machine: buildMachineReport(plan),
      human: buildHumanReport(plan),
    },
  };
}

export async function runMigrationCommit(): Promise<never> {
  throw new Error(PHASE_7_COMMIT_MODE_ERROR);
}

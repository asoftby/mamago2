import type {
  PhoenixEnvironmentContext,
  PhoenixMode,
  PhoenixPhaseAdapter,
  PhoenixPhaseName,
  PhoenixPhaseReport,
  PhoenixRecordResult,
  PhoenixReleaseManifest,
} from "./types";

export interface PhoenixReportStore {
  append(report: PhoenixPhaseReport): Promise<void>;
  readCompletedPrefix?(): Promise<readonly PhoenixPhaseReport[]>;
}

export interface RunPhoenixReleaseInput {
  manifest: PhoenixReleaseManifest;
  manifestPath: string;
  manifestHash: string;
  environment: PhoenixEnvironmentContext;
  mode: PhoenixMode;
  codeSha: string;
  adapters: Partial<Record<PhoenixPhaseName, PhoenixPhaseAdapter>>;
  reportStore: PhoenixReportStore;
  resumeFrom?: PhoenixPhaseName;
  previousReports?: readonly PhoenixPhaseReport[];
}

function firstUnexpectedFailure(results: readonly PhoenixRecordResult[]): PhoenixRecordResult | undefined {
  return results.find((result) => result.outcome === "FAILED");
}

function assertRerun(results: readonly PhoenixRecordResult[], deterministic: ReadonlySet<string>): void {
  const unexpected = results.find(
    (result) =>
      (result.outcome === "CREATED" || result.outcome === "UPDATED") &&
      !deterministic.has(result.sourceRecordKey),
  );
  if (unexpected) throw new Error(`RERUN_UNEXPECTED_${unexpected.outcome}: ${unexpected.sourceRecordKey}.`);
}

function assertResume(input: RunPhoenixReleaseInput, completedPrefix: readonly PhoenixPhaseName[]): void {
  if (!input.resumeFrom) return;
  const previous = input.previousReports ?? [];
  if (previous.length === 0) throw new Error("RESUME_REPORT_REQUIRED");
  for (const report of previous) {
    if (
      report.releaseId !== input.manifest.releaseId ||
      report.manifestHash !== input.manifestHash ||
      JSON.stringify(report.environmentFingerprint) !== JSON.stringify(input.environment)
    ) {
      throw new Error("RESUME_FINGERPRINT_MISMATCH");
    }
  }
  const resumeIndex = input.manifest.phaseOrder.indexOf(input.resumeFrom);
  if (resumeIndex < 0 || completedPrefix.length !== resumeIndex) throw new Error("RESUME_PREFIX_MISMATCH");
}

export async function runPhoenixRelease(input: RunPhoenixReleaseInput): Promise<PhoenixPhaseReport[]> {
  const completedPrefix = (input.previousReports ?? []).map((report) => report.phase);
  assertResume(input, completedPrefix);
  const output: PhoenixPhaseReport[] = [];
  const startIndex = input.resumeFrom ? input.manifest.phaseOrder.indexOf(input.resumeFrom) : 0;

  for (const phaseName of input.manifest.phaseOrder.slice(startIndex)) {
    const phase = input.manifest.phases.find((item) => item.name === phaseName);
    if (!phase) throw new Error(`UNKNOWN_PHASE: ${phaseName}.`);
    if (phase.status === "BLOCKED") throw new Error(`PHASE_BLOCKED: ${phaseName}: ${phase.blocker}`);
    if (input.mode !== "PLAN" && phase.status === "VALIDATION_ONLY") continue;
    const adapter = input.adapters[phaseName];
    if (!adapter) throw new Error(`PHASE_ADAPTER_MISSING: ${phaseName}.`);

    const results =
      input.mode === "PLAN"
        ? await adapter.plan(phase)
        : input.mode === "APPLY"
          ? await adapter.apply(phase)
          : await adapter.rerun(phase);
    const failure = firstUnexpectedFailure(results);
    if (failure) {
      const failureReport: PhoenixPhaseReport = {
        releaseId: input.manifest.releaseId,
        environment: input.environment.environment,
        codeSha: input.codeSha,
        manifestPath: input.manifestPath,
        manifestHash: input.manifestHash,
        phase: phaseName,
        attempted: results.length,
        created: results.filter((result) => result.outcome === "CREATED").length,
        updated: results.filter((result) => result.outcome === "UPDATED").length,
        skipped: results.filter((result) => result.outcome === "SKIPPED").length,
        protectedConflicts: results.filter((result) => result.outcome === "PROTECTED_CONFLICT").length,
        failed: 1,
        targetCountDelta: 0,
        migrationRecordDelta: 0,
        migrationLineageDelta: 0,
        duplicateLineage: 0,
        duplicateTargets: 0,
        mediaStorageDelta: 0,
        forbiddenTableAudit: "NOT_RUN",
        firstFailure: `${failure.sourceRecordKey}:${failure.error ?? "unknown"}`,
        completedPrefix: [...completedPrefix],
        environmentFingerprint: input.environment,
        resolvedIdentities: {},
      };
      await input.reportStore.append(failureReport);
      output.push(failureReport);
      throw new Error(`PHASE_FAILED: ${phaseName}:${failure.sourceRecordKey}:${failure.error ?? "unknown"}`);
    }
    if (input.mode === "RERUN") assertRerun(results, new Set(phase.deterministicConflicts));
    const reconciliation = await adapter.reconcile(phase, results);
    completedPrefix.push(phaseName);
    const report: PhoenixPhaseReport = {
      releaseId: input.manifest.releaseId,
      environment: input.environment.environment,
      codeSha: input.codeSha,
      manifestPath: input.manifestPath,
      manifestHash: input.manifestHash,
      phase: phaseName,
      attempted: results.length,
      created: results.filter((result) => result.outcome === "CREATED").length,
      updated: results.filter((result) => result.outcome === "UPDATED").length,
      skipped: results.filter((result) => result.outcome === "SKIPPED").length,
      protectedConflicts: results.filter((result) => result.outcome === "PROTECTED_CONFLICT").length,
      failed: 0,
      targetCountDelta: 0,
      migrationRecordDelta: 0,
      migrationLineageDelta: 0,
      duplicateLineage: 0,
      duplicateTargets: 0,
      mediaStorageDelta: 0,
      forbiddenTableAudit: input.mode === "PLAN" ? "NOT_RUN" : "PASS",
      firstFailure: null,
      completedPrefix: [...completedPrefix],
      environmentFingerprint: input.environment,
      resolvedIdentities: {},
      ...reconciliation,
    };
    await input.reportStore.append(report);
    output.push(report);
  }
  return output;
}

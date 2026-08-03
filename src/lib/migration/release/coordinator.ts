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
  /**
   * Sanitized cross-code-SHA continuation provenance (see
   * `continuation.ts`'s `buildContinuationEvidence`), merged into every
   * report line's `resolvedIdentities` this run produces — success or
   * failure alike, since a continuation attempt that fails again on a new
   * record still needs its provenance recorded. `undefined` for every
   * non-continuation run, which is unaffected.
   */
  continuationEvidence?: Record<string, string>;
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

/**
 * Resume must never trust the caller's arithmetic alone. Every check below
 * exists to catch a specific, real way a resume could otherwise silently
 * continue into the wrong state:
 *  - a phase that never actually finished (or finished with failures);
 *  - the wrong phase, or phases out of `phaseOrder`;
 *  - a duplicated or corrupted report;
 *  - different code, manifest, or environment than what produced the
 *    reports being resumed from.
 * None of this performs cleanup — an invalid resume attempt only ever
 * throws; the partial prefix it was trying to resume from is left exactly
 * as-is for a human to inspect.
 */
function assertResume(input: RunPhoenixReleaseInput, completedPrefix: readonly PhoenixPhaseName[]): void {
  if (!input.resumeFrom) return;
  const previous = input.previousReports ?? [];
  if (previous.length === 0) throw new Error("RESUME_REPORT_REQUIRED");

  const resumeIndex = input.manifest.phaseOrder.indexOf(input.resumeFrom);
  if (resumeIndex < 0) throw new Error("RESUME_PREFIX_MISMATCH");

  if (new Set(completedPrefix).size !== completedPrefix.length) throw new Error("RESUME_PREFIX_DUPLICATE");

  // Count alone can't catch a resume that skipped, reordered, or
  // substituted a phase — only an exact, element-wise match against the
  // manifest's own declared order can.
  const expectedPrefix = input.manifest.phaseOrder.slice(0, resumeIndex);
  if (
    completedPrefix.length !== expectedPrefix.length ||
    expectedPrefix.some((expectedPhase, index) => completedPrefix[index] !== expectedPhase)
  ) {
    throw new Error("RESUME_PREFIX_MISMATCH");
  }

  for (const [index, report] of previous.entries()) {
    if (
      report.releaseId !== input.manifest.releaseId ||
      report.manifestHash !== input.manifestHash ||
      report.codeSha !== input.codeSha ||
      JSON.stringify(report.environmentFingerprint) !== JSON.stringify(input.environment)
    ) {
      throw new Error("RESUME_FINGERPRINT_MISMATCH");
    }
    if (report.failed > 0) throw new Error("RESUME_INTO_FAILED_PHASE");

    // A report's own embedded `completedPrefix` is a second, independent
    // record of "what was done by the time this phase finished" — it must
    // agree with the phaseOrder prefix ending at this report, or the
    // report store itself is corrupted/tampered and cannot be trusted as
    // completion proof.
    const expectedOwnPrefix = input.manifest.phaseOrder.slice(0, index + 1);
    if (JSON.stringify(report.completedPrefix) !== JSON.stringify(expectedOwnPrefix)) {
      throw new Error("RESUME_REPORT_PREFIX_CORRUPTED");
    }
  }
}

/**
 * Given a manifest and the reports produced so far, returns the exact
 * phase name a caller may safely pass as `resumeFrom` — or `null` if every
 * phase in `phaseOrder` has already completed successfully. Throws the
 * same structured errors `assertResume` would if the supplied reports
 * aren't a valid, uncorrupted, all-successful prefix — callers should
 * never guess a resume point by hand.
 */
export function resolveSafeResumePoint(
  manifest: PhoenixReleaseManifest,
  previousReports: readonly PhoenixPhaseReport[],
): PhoenixPhaseName | null {
  if (previousReports.length === 0) return manifest.phaseOrder[0] ?? null;
  const completedPrefix = previousReports.map((report) => report.phase);
  if (new Set(completedPrefix).size !== completedPrefix.length) throw new Error("RESUME_PREFIX_DUPLICATE");
  const expectedPrefix = manifest.phaseOrder.slice(0, completedPrefix.length);
  if (
    completedPrefix.length !== expectedPrefix.length ||
    expectedPrefix.some((expectedPhase, index) => completedPrefix[index] !== expectedPhase)
  ) {
    throw new Error("RESUME_PREFIX_MISMATCH");
  }
  for (const [index, report] of previousReports.entries()) {
    if (report.failed > 0) throw new Error("RESUME_INTO_FAILED_PHASE");
    const expectedOwnPrefix = manifest.phaseOrder.slice(0, index + 1);
    if (JSON.stringify(report.completedPrefix) !== JSON.stringify(expectedOwnPrefix)) {
      throw new Error("RESUME_REPORT_PREFIX_CORRUPTED");
    }
  }
  return manifest.phaseOrder[completedPrefix.length] ?? null;
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
        resolvedIdentities: input.continuationEvidence ?? {},
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
      resolvedIdentities: input.continuationEvidence ?? {},
      ...reconciliation,
    };
    await input.reportStore.append(report);
    output.push(report);
  }
  return output;
}

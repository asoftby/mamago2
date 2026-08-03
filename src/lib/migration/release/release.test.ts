import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SequentialEntityPhaseAdapter } from "./adapter";
import { resolveSafeResumePoint, runPhoenixRelease } from "./coordinator";
import { loadPhoenixEnvironment } from "./environment";
import { resolveLogicalIdentity } from "./identity";
import {
  exactExecutableKeys,
  parsePhoenixReleaseManifest,
  sha256Bytes,
  verifyArtifactHashes,
} from "./manifest";
import { JsonLinesPhoenixReportStore, sanitizeReport } from "./report";
import type {
  PhoenixEnvironmentContext,
  PhoenixPhaseReport,
  PhoenixRecordResult,
  PhoenixReleaseManifest,
  PhoenixReleasePhase,
} from "./types";

const environment: PhoenixEnvironmentContext = {
  environment: "DEV",
  database: {
    environment: "DEV",
    host: "dev-db.internal",
    port: "5432",
    database: "mamago_dev",
    schema: "public",
    currentDatabase: "mamago_dev",
  },
  storage: { environment: "DEV", provider: "filesystem", locationHash: "safe-hash" },
};

function phase(records: PhoenixReleasePhase["records"]): PhoenixReleasePhase {
  return {
    name: "places",
    status: "READY",
    artifacts: [],
    records,
    protectedSourceRecordKeys: [],
    excludedSourceRecordKeys: [],
    deterministicConflicts: [],
    mediaPolicy: "METADATA",
    prerequisites: [],
  };
}

function manifest(records: PhoenixReleasePhase["records"]): PhoenixReleaseManifest {
  return {
    schemaVersion: 1,
    releaseId: "test-release",
    phaseOrder: ["places"],
    phases: [phase(records)],
  };
}

async function expectReject(action: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  await assert.rejects(action, pattern);
}

async function testManifestHashMismatch(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "phoenix-release-test-"));
  const artifactPath = join(root, "artifact.json");
  const manifestPath = join(root, "manifest.json");
  writeFileSync(artifactPath, "{}");
  const value = manifest([]);
  value.phases[0].artifacts = [{
    path: artifactPath,
    sha256: "0".repeat(64),
    executable: true,
    description: "fixture",
  }];
  writeFileSync(manifestPath, JSON.stringify(value));
  assert.throws(() => verifyArtifactHashes(manifestPath, value), /ARTIFACT_HASH_MISMATCH/);
  value.phases[0].artifacts[0].sha256 = sha256Bytes(readFileSync(artifactPath));
  verifyArtifactHashes(manifestPath, value);
}

async function testEnvironmentGates(): Promise<void> {
  const base = {
    NODE_ENV: "development" as const,
    APP_ENV: "DEV",
    PHOENIX_DATABASE_ENV: "DEV",
    PHOENIX_STORAGE_ENV: "DEV",
    PHOENIX_STORAGE_PROVIDER: "filesystem",
    PHOENIX_STORAGE_LOCATION: "/safe/dev",
    DATABASE_URL: "postgresql://secret-user:secret-password@dev-db.internal:5432/mamago_dev?schema=public",
    SITE_INDEXING_ENABLED: "false",
    MIGRATED_USER_ACTIVATION_EMAIL_ENABLED: "false",
  };
  await expectReject(
    () => loadPhoenixEnvironment({ environment: "PROD", confirmProduction: false, env: base }),
    /PRODUCTION_CONFIRMATION_REQUIRED/,
  );
  await expectReject(
    () =>
      loadPhoenixEnvironment({
        environment: "DEV",
        confirmProduction: false,
        env: { ...base, PHOENIX_DATABASE_ENV: "PROD" },
      }),
    /DATABASE_ENV_MISMATCH/,
  );
  const result = await loadPhoenixEnvironment({
    environment: "DEV",
    confirmProduction: false,
    env: base,
    currentDatabase: async () => ({ currentDatabase: "mamago_dev", schema: "public" }),
  });
  assert.equal(result.database.host, "dev-db.internal");
  assert(!JSON.stringify(result).includes("secret-password"));
}

async function testIdentityCardinality(): Promise<void> {
  const identity = { kind: "citySlug" as const, value: "minsk" };
  await expectReject(() => resolveLogicalIdentity({ find: async () => [] }, identity), /NOT_FOUND/);
  assert.equal(await resolveLogicalIdentity({ find: async () => [{ id: "city-1" }] }, identity), "city-1");
  await expectReject(
    () => resolveLogicalIdentity({ find: async () => [{ id: "1" }, { id: "2" }] }, identity),
    /AMBIGUOUS/,
  );
}

async function testExactScopeOfferSequenceAndStop(): Promise<void> {
  const calls: string[] = [];
  const adapter = new SequentialEntityPhaseAdapter({
    execute: async (sourceRecordKey, action) => {
      calls.push(sourceRecordKey);
      return {
        sourceRecordKey,
        action,
        outcome: sourceRecordKey === "offer:2" ? "FAILED" : "CREATED",
      };
    },
  });
  const offerPhase = {
    ...phase([
      { sourceRecordKey: "offer:1", action: "CREATE" },
      { sourceRecordKey: "offer:2", action: "CREATE" },
      { sourceRecordKey: "offer:3", action: "CREATE" },
    ]),
    name: "offers" as const,
  };
  offerPhase.excludedSourceRecordKeys = ["offer:3"];
  assert.deepEqual(exactExecutableKeys(offerPhase), ["offer:1", "offer:2"]);
  const results = await adapter.apply(offerPhase);
  assert.deepEqual(calls, ["offer:1", "offer:2"]);
  assert.equal(results.at(-1)?.outcome, "FAILED");
}

// --- Scenario 1: a fresh full apply (no continuation involved) still
// completes every canonical record exactly once, including one whose
// manifest-declared action correctly matches the live plan.
async function testFreshFullApplyCompletesAllCanonicalRecords(): Promise<void> {
  const calls: string[] = [];
  const adapter = new SequentialEntityPhaseAdapter({
    execute: async (sourceRecordKey, action) => {
      calls.push(sourceRecordKey);
      return { sourceRecordKey, action, outcome: "CREATED" };
    },
  });
  const keys = Array.from({ length: 25 }, (_, i) => `wordpress-db:user:${i}`);
  const usersPhase = { ...phase(keys.map((sourceRecordKey) => ({ sourceRecordKey, action: "CREATE" as const }))), name: "users" as const };
  const results = await adapter.apply(usersPhase);
  assert.deepEqual(calls, keys, "every canonical record is attempted exactly once, in order");
  assert.equal(results.length, keys.length);
  assert(results.every((r) => r.outcome === "CREATED"));
}

// --- Scenario 2: continuing with a live-DB-verified completed prefix skips
// exactly those records (never calling the executor for them) and completes
// the remaining suffix — including the record that previously failed —
// exactly once each.
async function testContinuationSkipsCompletedPrefixAndCompletesSuffix(): Promise<void> {
  const executed: string[] = [];
  const allKeys = Array.from({ length: 25 }, (_, i) => `wordpress-db:user:${i}`);
  const completedPrefix = new Set(allKeys.slice(0, 20)); // matches the exact 20-key DEV partial state
  const adapter = new SequentialEntityPhaseAdapter(
    {
      execute: async (sourceRecordKey, action) => {
        executed.push(sourceRecordKey);
        return { sourceRecordKey, action, outcome: "CREATED" };
      },
    },
    completedPrefix,
  );
  const usersPhase = { ...phase(allKeys.map((sourceRecordKey) => ({ sourceRecordKey, action: "CREATE" as const }))), name: "users" as const };
  const results = await adapter.apply(usersPhase);

  assert.deepEqual(executed, allKeys.slice(20), "only the not-yet-completed suffix reaches the executor");
  assert.equal(results.length, allKeys.length, "the skipped prefix still appears in the results, just without a live plan/write");
  for (const key of allKeys.slice(0, 20)) {
    const result = results.find((r) => r.sourceRecordKey === key);
    assert.equal(result?.outcome, "SKIPPED", `${key} must be skipped, not re-derived`);
  }
  for (const key of allKeys.slice(20)) {
    const result = results.find((r) => r.sourceRecordKey === key);
    assert.equal(result?.outcome, "CREATED");
  }
}

// --- Scenario 3: repeating a continuation whose completed set already
// covers every executable record must create nothing new — CREATE 0, only
// SKIPPED (the release-runner's NOOP-equivalent outcome for this adapter).
async function testRepeatedContinuationCreatesNothingNew(): Promise<void> {
  const executed: string[] = [];
  const allKeys = Array.from({ length: 10 }, (_, i) => `wordpress-db:user:${i}`);
  const adapter = new SequentialEntityPhaseAdapter(
    {
      execute: async (sourceRecordKey, action) => {
        executed.push(sourceRecordKey);
        return { sourceRecordKey, action, outcome: "CREATED" };
      },
    },
    new Set(allKeys),
  );
  const usersPhase = { ...phase(allKeys.map((sourceRecordKey) => ({ sourceRecordKey, action: "CREATE" as const }))), name: "users" as const };
  const results = await adapter.apply(usersPhase);

  assert.deepEqual(executed, [], "the executor must never be called for an already-fully-completed phase");
  assert.equal(results.length, allKeys.length);
  assert(results.every((r) => r.outcome === "SKIPPED"), "every record resolves SKIPPED, matching CREATE 0");
}

// --- Scenario 7 (part 2): a fail-closed record outside the proven-complete
// set is still attempted normally, and the sequential stop-on-first-error
// behavior is unaffected by an unrelated completed set.
async function testNonPrefixRecordStillFailsClosedNormally(): Promise<void> {
  const executed: string[] = [];
  const adapter = new SequentialEntityPhaseAdapter(
    {
      execute: async (sourceRecordKey, action) => {
        executed.push(sourceRecordKey);
        return { sourceRecordKey, action, outcome: sourceRecordKey === "wordpress-db:user:38" ? "FAILED" : "CREATED" };
      },
    },
    new Set(["wordpress-db:user:1"]),
  );
  const usersPhase = {
    ...phase([
      { sourceRecordKey: "wordpress-db:user:1", action: "CREATE" },
      { sourceRecordKey: "wordpress-db:user:38", action: "SKIP_UNCHANGED" },
      { sourceRecordKey: "wordpress-db:user:39", action: "CREATE" },
    ]),
    name: "users" as const,
  };
  const results = await adapter.apply(usersPhase);
  assert.deepEqual(executed, ["wordpress-db:user:38"], "the completed key is skipped; the phase still stops at the first real failure");
  assert.equal(results.at(-1)?.outcome, "FAILED");
  assert.equal(results.length, 2, "user:39 is never reached after the failure, exactly as stop-on-first-error requires");
}

// Section 5: continuation-chain evidence is recorded into every report line
// this run produces — success or failure alike — via `resolvedIdentities`,
// and is entirely absent for a non-continuation run.
async function testContinuationEvidenceRecordedInReports(): Promise<void> {
  const evidence = {
    continuationPredecessorCodeSha: "f466c34c0cf095d054ae79d86a12505129719739",
    continuationPredecessorReportSha256: "a".repeat(64),
    continuationPredecessorTerminalFailedKey: "wordpress-db:user:38",
    continuationSkippedCompletedPrefixCount: "20",
    continuationStartKey: "wordpress-db:user:38",
  };
  const base = {
    manifest: manifest([{ sourceRecordKey: "wordpress-db:user:38", action: "CREATE" as const }]),
    manifestPath: "manifest.json",
    manifestHash: "manifest-hash",
    environment,
    codeSha: "new-code-sha",
    continuationEvidence: evidence,
  };

  const successReports: PhoenixPhaseReport[] = [];
  const okAdapter = new SequentialEntityPhaseAdapter({
    execute: async (sourceRecordKey, action) => ({ sourceRecordKey, action, outcome: "CREATED" }),
  });
  await runPhoenixRelease({
    ...base,
    mode: "APPLY",
    adapters: { places: okAdapter },
    reportStore: { append: async (report) => void successReports.push(report) },
  });
  assert.deepEqual(successReports[0].resolvedIdentities, evidence);

  const failureReports: PhoenixPhaseReport[] = [];
  const failingAdapter = new SequentialEntityPhaseAdapter({
    execute: async (sourceRecordKey, action) => ({ sourceRecordKey, action, outcome: "FAILED", error: "injected" }),
  });
  await expectReject(
    () =>
      runPhoenixRelease({
        ...base,
        mode: "APPLY",
        adapters: { places: failingAdapter },
        reportStore: { append: async (report) => void failureReports.push(report) },
      }),
    /PHASE_FAILED/,
  );
  assert.deepEqual(failureReports[0].resolvedIdentities, evidence);

  // A non-continuation run (no `continuationEvidence`) records nothing extra.
  const plainReports: PhoenixPhaseReport[] = [];
  await runPhoenixRelease({
    ...base,
    continuationEvidence: undefined,
    mode: "APPLY",
    adapters: { places: okAdapter },
    reportStore: { append: async (report) => void plainReports.push(report) },
  });
  assert.deepEqual(plainReports[0].resolvedIdentities, {});
}

async function testCoordinatorReportsResumeAndRerun(): Promise<void> {
  const reports: PhoenixPhaseReport[] = [];
  const planAdapter = new SequentialEntityPhaseAdapter({
    execute: async (sourceRecordKey, action) => ({ sourceRecordKey, action, outcome: "SKIPPED" }),
  });
  const base = {
    manifest: manifest([{ sourceRecordKey: "wordpress-db:places:5457", action: "SKIP_UNCHANGED" }]),
    manifestPath: "manifest.json",
    manifestHash: "manifest-hash",
    environment,
    codeSha: "code-sha",
    adapters: { places: planAdapter },
    reportStore: { append: async (report: PhoenixPhaseReport) => void reports.push(report) },
  };
  const planned = await runPhoenixRelease({ ...base, mode: "PLAN" });
  assert.equal(planned[0].skipped, 1, "existing lineage golden 5457 remains SKIP_UNCHANGED");
  assert.deepEqual(reports[0].completedPrefix, ["places"]);

  // Isolates the fingerprint check from the (stricter) prefix check: a
  // two-phase manifest lets `previousReports` be a genuinely valid
  // completed-prefix (["places"], resuming into "offers") except for the
  // injected manifestHash mismatch.
  const twoPhaseManifest: PhoenixReleaseManifest = {
    ...base.manifest,
    phaseOrder: ["places", "offers"],
    phases: [...base.manifest.phases, { ...phase([]), name: "offers" }],
  };
  await expectReject(
    () =>
      runPhoenixRelease({
        ...base,
        manifest: twoPhaseManifest,
        mode: "PLAN",
        resumeFrom: "offers",
        previousReports: [{ ...reports[0], manifestHash: "different" }],
      }),
    /RESUME_FINGERPRINT_MISMATCH/,
  );

  const badRerun = new SequentialEntityPhaseAdapter({
    execute: async (sourceRecordKey, action): Promise<PhoenixRecordResult> => ({
      sourceRecordKey,
      action,
      outcome: "CREATED",
    }),
  });
  await expectReject(
    () => runPhoenixRelease({ ...base, mode: "RERUN", adapters: { places: badRerun } }),
    /RERUN_UNEXPECTED_CREATED/,
  );

  const failureReports: PhoenixPhaseReport[] = [];
  const failing = new SequentialEntityPhaseAdapter({
    execute: async (sourceRecordKey, action) => ({
      sourceRecordKey,
      action,
      outcome: "FAILED",
      error: "injected",
    }),
  });
  await expectReject(
    () =>
      runPhoenixRelease({
        ...base,
        mode: "APPLY",
        adapters: { places: failing },
        reportStore: { append: async (report) => void failureReports.push(report) },
      }),
    /PHASE_FAILED/,
  );
  assert.equal(failureReports[0].firstFailure, "wordpress-db:places:5457:injected");
  assert.deepEqual(failureReports[0].completedPrefix, []);
}

function fakeReport(overrides: Partial<PhoenixPhaseReport> & Pick<PhoenixPhaseReport, "phase" | "completedPrefix">): PhoenixPhaseReport {
  return {
    releaseId: "test-release",
    environment: "DEV",
    codeSha: "code-sha",
    manifestPath: "manifest.json",
    manifestHash: "manifest-hash",
    attempted: 0,
    created: 0,
    updated: 0,
    skipped: 1,
    protectedConflicts: 0,
    failed: 0,
    targetCountDelta: 0,
    migrationRecordDelta: 0,
    migrationLineageDelta: 0,
    duplicateLineage: 0,
    duplicateTargets: 0,
    mediaStorageDelta: 0,
    forbiddenTableAudit: "PASS",
    firstFailure: null,
    environmentFingerprint: environment,
    resolvedIdentities: {},
    ...overrides,
  };
}

async function testResumeValidationHardening(): Promise<void> {
  const twoPhase: PhoenixReleaseManifest = {
    schemaVersion: 1,
    releaseId: "test-release",
    phaseOrder: ["places", "offers"],
    phases: [phase([]), { ...phase([]), name: "offers" }],
  };
  const noopAdapter = new SequentialEntityPhaseAdapter({
    execute: async (sourceRecordKey, action) => ({ sourceRecordKey, action, outcome: "SKIPPED" }),
  });
  const base = {
    manifest: twoPhase,
    manifestPath: "manifest.json",
    manifestHash: "manifest-hash",
    environment,
    codeSha: "code-sha",
    adapters: { offers: noopAdapter },
    reportStore: { append: async () => {} },
    mode: "PLAN" as const,
  };
  const goodPlacesReport = fakeReport({ phase: "places", completedPrefix: ["places"] });

  // codeSha mismatch: same manifest/environment, different code than what
  // produced the prior report.
  await expectReject(
    () =>
      runPhoenixRelease({ ...base, resumeFrom: "offers", previousReports: [{ ...goodPlacesReport, codeSha: "different-sha" }] }),
    /RESUME_FINGERPRINT_MISMATCH/,
  );

  // Duplicate phase in previousReports.
  await expectReject(
    () =>
      runPhoenixRelease({
        ...base,
        resumeFrom: "offers",
        previousReports: [goodPlacesReport, { ...goodPlacesReport, phase: "places" }],
      }),
    /RESUME_PREFIX_DUPLICATE/,
  );

  // Corrupted per-report completedPrefix: the report claims "places" and
  // "offers" both done, but only reports for "places" were actually supplied.
  await expectReject(
    () =>
      runPhoenixRelease({
        ...base,
        resumeFrom: "offers",
        previousReports: [{ ...goodPlacesReport, completedPrefix: ["places", "offers"] }],
      }),
    /RESUME_REPORT_PREFIX_CORRUPTED/,
  );

  // Resuming past a phase that itself failed must never be allowed, even
  // if the prefix/fingerprints otherwise line up.
  await expectReject(
    () =>
      runPhoenixRelease({
        ...base,
        resumeFrom: "offers",
        previousReports: [{ ...goodPlacesReport, failed: 1 }],
      }),
    /RESUME_INTO_FAILED_PHASE/,
  );

  // The valid case must still work: exact matching prefix, fingerprints,
  // and codeSha all agree.
  const validResult = await runPhoenixRelease({ ...base, resumeFrom: "offers", previousReports: [goodPlacesReport] });
  assert.equal(validResult.length, 1);
  assert.equal(validResult[0].phase, "offers");
}

function testResolveSafeResumePoint(): void {
  const twoPhase: PhoenixReleaseManifest = {
    schemaVersion: 1,
    releaseId: "test-release",
    phaseOrder: ["places", "offers"],
    phases: [phase([]), { ...phase([]), name: "offers" }],
  };
  assert.equal(resolveSafeResumePoint(twoPhase, []), "places", "nothing completed yet -> resume from the first phase");
  const goodPlacesReport = fakeReport({ phase: "places", completedPrefix: ["places"] });
  assert.equal(resolveSafeResumePoint(twoPhase, [goodPlacesReport]), "offers");
  assert.equal(
    resolveSafeResumePoint(twoPhase, [goodPlacesReport, fakeReport({ phase: "offers", completedPrefix: ["places", "offers"] })]),
    null,
    "every phase completed -> nothing left to resume",
  );
  assert.throws(() => resolveSafeResumePoint(twoPhase, [{ ...goodPlacesReport, failed: 1 }]), /RESUME_INTO_FAILED_PHASE/);
  assert.throws(
    () => resolveSafeResumePoint(twoPhase, [goodPlacesReport, { ...goodPlacesReport, phase: "places" }]),
    /RESUME_PREFIX_DUPLICATE/,
  );
  assert.throws(
    () => resolveSafeResumePoint(twoPhase, [{ ...goodPlacesReport, completedPrefix: ["places", "offers"] }]),
    /RESUME_REPORT_PREFIX_CORRUPTED/,
  );
}

async function testAppendOnlySecretFreeReport(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "phoenix-report-test-"));
  const path = join(root, "audit.jsonl");
  const store = new JsonLinesPhoenixReportStore(path);
  const sanitized = sanitizeReport({ token: "bad", nested: { password: "bad", safe: "yes" } });
  assert.deepEqual(sanitized, { nested: { safe: "yes" } });
  const baseReport = {
    releaseId: "r",
    environment: "DEV" as const,
    codeSha: "sha",
    manifestPath: "m",
    manifestHash: "h",
    phase: "places" as const,
    attempted: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    protectedConflicts: 0,
    failed: 0,
    targetCountDelta: 0,
    migrationRecordDelta: 0,
    migrationLineageDelta: 0,
    duplicateLineage: 0,
    duplicateTargets: 0,
    mediaStorageDelta: 0,
    forbiddenTableAudit: "NOT_RUN" as const,
    firstFailure: null,
    completedPrefix: ["places" as const],
    environmentFingerprint: environment,
    resolvedIdentities: {},
  };
  await store.append(baseReport);
  await store.append(baseReport);
  assert.equal(readFileSync(path, "utf8").trim().split("\n").length, 2);
  assert(!readFileSync(path, "utf8").includes("password"));
}

async function main(): Promise<void> {
  parsePhoenixReleaseManifest(JSON.stringify(manifest([])), "fixture");
  await testManifestHashMismatch();
  await testEnvironmentGates();
  await testIdentityCardinality();
  await testExactScopeOfferSequenceAndStop();
  await testFreshFullApplyCompletesAllCanonicalRecords();
  await testContinuationSkipsCompletedPrefixAndCompletesSuffix();
  await testRepeatedContinuationCreatesNothingNew();
  await testNonPrefixRecordStillFailsClosedNormally();
  await testContinuationEvidenceRecordedInReports();
  await testCoordinatorReportsResumeAndRerun();
  await testResumeValidationHardening();
  testResolveSafeResumePoint();
  await testAppendOnlySecretFreeReport();
  console.log("Phoenix release tests: PASS");
}

void main();

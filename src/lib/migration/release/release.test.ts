import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { SequentialEntityPhaseAdapter } from "./adapter";
import { runPhoenixRelease } from "./coordinator";
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

  await expectReject(
    () =>
      runPhoenixRelease({
        ...base,
        mode: "PLAN",
        resumeFrom: "places",
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
  await testCoordinatorReportsResumeAndRerun();
  await testAppendOnlySecretFreeReport();
  console.log("Phoenix release tests: PASS");
}

void main();

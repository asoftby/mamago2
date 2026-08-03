import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  KNOWN_PREDECESSOR_CODE_SHAS,
  PHOENIX_RELEASE_ACTION_EXCEPTIONS,
  applyReleaseActionExceptions,
  buildContinuationEvidence,
  extractFailedKey,
  loadCrossShaContinuationReport,
  resolveExactCompletedPrefix,
} from "./continuation";
import { sha256Bytes } from "./manifest";
import type { PhoenixEnvironmentContext, PhoenixPhaseReport, PhoenixReleasePhase } from "./types";

const PREDECESSOR_CODE_SHA = "f466c34c0cf095d054ae79d86a12505129719739";
const NEW_CODE_SHA = "b".repeat(40);

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

function fakeReport(overrides: Partial<PhoenixPhaseReport> = {}): PhoenixPhaseReport {
  return {
    releaseId: "phoenix-approved-test",
    environment: "DEV",
    codeSha: PREDECESSOR_CODE_SHA,
    manifestPath: "manifest.json",
    manifestHash: "manifest-hash",
    phase: "users",
    attempted: 21,
    created: 20,
    updated: 0,
    skipped: 0,
    protectedConflicts: 0,
    failed: 1,
    targetCountDelta: 0,
    migrationRecordDelta: 0,
    migrationLineageDelta: 0,
    duplicateLineage: 0,
    duplicateTargets: 0,
    mediaStorageDelta: 0,
    forbiddenTableAudit: "NOT_RUN",
    firstFailure: "wordpress-db:user:38:UNEXPECTED_PLAN_ACTION:CREATE",
    completedPrefix: [],
    environmentFingerprint: environment,
    resolvedIdentities: {},
    ...overrides,
  };
}

const expectedIdentity = {
  releaseId: "phoenix-approved-test",
  manifestHash: "manifest-hash",
  currentCodeSha: NEW_CODE_SHA,
  environment,
};

function tempReportPath(content: string): string {
  const root = mkdtempSync(join(tmpdir(), "phoenix-continuation-test-"));
  const path = join(root, "dev.jsonl");
  writeFileSync(path, content);
  return path;
}

function reportRequest(raw: string, overrides: Partial<{ reportSha256: string; predecessorCodeSha: string }> = {}) {
  return {
    reportPath: tempReportPath(raw),
    reportSha256: overrides.reportSha256 ?? sha256Bytes(raw),
    predecessorCodeSha: overrides.predecessorCodeSha ?? PREDECESSOR_CODE_SHA,
  };
}

// =============================================================================
// Section 2 — cross-code-SHA continuation identity
// =============================================================================

// Test 1: accepted only with the exact explicit predecessor SHA + report SHA-256.
function testCrossShaAcceptsExactExplicitAuthorization(): void {
  const raw = `${JSON.stringify(fakeReport())}\n`;
  const report = loadCrossShaContinuationReport(reportRequest(raw), expectedIdentity);
  assert.equal(report.codeSha, PREDECESSOR_CODE_SHA);
  assert.equal(report.firstFailure, "wordpress-db:user:38:UNEXPECTED_PLAN_ACTION:CREATE");
}

// Test 2: wrong predecessor code SHA fails closed (not in the allowlist at all).
function testCrossShaRejectsUnknownPredecessorCodeSha(): void {
  const unknownSha = "1".repeat(40);
  const raw = `${JSON.stringify(fakeReport({ codeSha: unknownSha }))}\n`;
  assert.throws(
    () => loadCrossShaContinuationReport(reportRequest(raw, { predecessorCodeSha: unknownSha }), expectedIdentity),
    /CONTINUATION_PREDECESSOR_CODE_SHA_UNKNOWN/,
  );
  assert(!KNOWN_PREDECESSOR_CODE_SHAS.has(unknownSha), "fixture sanity: this SHA must not be in the allowlist");
}

// Test 3: wrong report SHA-256 fails closed.
function testCrossShaRejectsWrongReportSha256(): void {
  const raw = `${JSON.stringify(fakeReport())}\n`;
  assert.throws(
    () => loadCrossShaContinuationReport(reportRequest(raw, { reportSha256: "0".repeat(64) }), expectedIdentity),
    /CONTINUATION_REPORT_SHA256_MISMATCH/,
  );
}

// Test 4: same report without matching cross-SHA authorization fails closed
// (the report's own codeSha disagrees with the explicitly supplied predecessor SHA).
function testCrossShaRejectsReportCodeShaDisagreement(): void {
  const raw = `${JSON.stringify(fakeReport({ codeSha: "c".repeat(40) }))}\n`;
  assert.throws(
    () => loadCrossShaContinuationReport(reportRequest(raw), expectedIdentity),
    /CONTINUATION_REPORT_CODE_SHA_MISMATCH/,
  );
}

function testCrossShaRejectsCurrentCodeShaEqualToPredecessor(): void {
  const raw = `${JSON.stringify(fakeReport())}\n`;
  assert.throws(
    () =>
      loadCrossShaContinuationReport(reportRequest(raw), { ...expectedIdentity, currentCodeSha: PREDECESSOR_CODE_SHA }),
    /CONTINUATION_CODE_SHA_UNCHANGED/,
  );
}

function testCrossShaRejectsIdentityMismatches(): void {
  const raw = (overrides: Partial<PhoenixPhaseReport>) => `${JSON.stringify(fakeReport(overrides))}\n`;
  assert.throws(
    () => loadCrossShaContinuationReport(reportRequest(raw({ releaseId: "other-release" })), expectedIdentity),
    /CONTINUATION_RELEASE_ID_MISMATCH/,
  );
  assert.throws(
    () => loadCrossShaContinuationReport(reportRequest(raw({ manifestHash: "different-hash" })), expectedIdentity),
    /CONTINUATION_MANIFEST_HASH_MISMATCH/,
  );
  assert.throws(
    () => loadCrossShaContinuationReport(reportRequest(raw({ environment: "PROD" })), expectedIdentity),
    /CONTINUATION_ENVIRONMENT_MISMATCH/,
  );
  assert.throws(
    () =>
      loadCrossShaContinuationReport(
        reportRequest(raw({ environmentFingerprint: { ...environment, database: { ...environment.database, host: "other-host" } } })),
        expectedIdentity,
      ),
    /CONTINUATION_ENVIRONMENT_FINGERPRINT_MISMATCH/,
  );
}

function testCrossShaRejectsNonFailureReport(): void {
  const raw = `${JSON.stringify(fakeReport({ failed: 0, firstFailure: null }))}\n`;
  assert.throws(() => loadCrossShaContinuationReport(reportRequest(raw), expectedIdentity), /CONTINUATION_REPORT_NOT_A_FAILURE/);
}

function testCrossShaRejectsMalformedEmptyMultiLineOrUnreadableReport(): void {
  assert.throws(() => loadCrossShaContinuationReport(reportRequest("not json at all\n"), expectedIdentity), /CONTINUATION_REPORT_MALFORMED/);
  assert.throws(() => loadCrossShaContinuationReport(reportRequest(""), expectedIdentity), /CONTINUATION_REPORT_EMPTY/);
  const multiLine = `${JSON.stringify(fakeReport())}\n${JSON.stringify(fakeReport({ firstFailure: "wordpress-db:user:39:X" }))}\n`;
  assert.throws(() => loadCrossShaContinuationReport(reportRequest(multiLine), expectedIdentity), /CONTINUATION_REPORT_NOT_SINGLE_ENTRY/);
  assert.throws(
    () =>
      loadCrossShaContinuationReport(
        { reportPath: "/nonexistent/path/dev.jsonl", reportSha256: "0".repeat(64), predecessorCodeSha: PREDECESSOR_CODE_SHA },
        expectedIdentity,
      ),
    /CONTINUATION_REPORT_UNREADABLE/,
  );
}

// =============================================================================
// Section 3 — exact completed-prefix proof
// =============================================================================

const FAILED_KEY = "wordpress-db:user:38";

function usersPhaseFixture(overrideAction?: { index: number; action: PhoenixReleasePhase["records"][number]["action"] }): PhoenixReleasePhase {
  const before = Array.from({ length: 20 }, (_, i) => `wordpress-db:user:${i + 1}`);
  const after = Array.from({ length: 4 }, (_, i) => `wordpress-db:user:${i + 39}`);
  const keys = [...before, FAILED_KEY, ...after];
  const records = keys.map((sourceRecordKey) => ({
    sourceRecordKey,
    action: (sourceRecordKey === FAILED_KEY ? "SKIP_UNCHANGED" : "CREATE") as PhoenixReleasePhase["records"][number]["action"],
  }));
  if (overrideAction) records[overrideAction.index] = { ...records[overrideAction.index], action: overrideAction.action };
  return {
    name: "users",
    status: "READY",
    artifacts: [],
    records,
    protectedSourceRecordKeys: [],
    excludedSourceRecordKeys: [],
    deterministicConflicts: [],
    mediaPolicy: "NOT_APPLICABLE",
    prerequisites: [],
  };
}

function fakePrisma(rows: Array<{ sourceRecordKey: string }>) {
  return {
    migrationLineage: {
      findMany: async () => rows,
    },
  } as unknown as import("@prisma/client").PrismaClient;
}

function completedPrefixKeys(): string[] {
  return usersPhaseFixture().records.slice(0, 20).map((r) => r.sourceRecordKey);
}

// Test 5 / 6 / 7: exact 20-key DEV prefix continues directly at user:38, no
// deliberate intermediate failed apply required — this call is the entire
// mechanism, driven straight off the original predecessor report.
async function testExactPrefixContinuesDirectlyAtUser38(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = fakeReport({ created: 20, updated: 0 });
  const rows = completedPrefixKeys().map((sourceRecordKey) => ({ sourceRecordKey }));
  const resolved = await resolveExactCompletedPrefix(fakePrisma(rows), "phoenix-release-bundle", report, phase);
  assert.equal(resolved.phase, "users");
  assert.equal(resolved.continuationStartKey, FAILED_KEY);
  assert.deepEqual([...resolved.alreadyCompleted].sort(), completedPrefixKeys().sort());
  assert.equal(resolved.alreadyCompleted.size, 20);
}

async function testExactPrefixRejectsMissingKeyInsidePrefix(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = fakeReport();
  const rows = completedPrefixKeys()
    .filter((key) => key !== "wordpress-db:user:5")
    .map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(
    () => resolveExactCompletedPrefix(fakePrisma(rows), "phoenix-release-bundle", report, phase),
    /CONTINUATION_PREFIX_KEY_MISSING:wordpress-db:user:5/,
  );
}

async function testExactPrefixRejectsCompletedKeyAfterFailedKey(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = fakeReport();
  const rows = [...completedPrefixKeys(), "wordpress-db:user:39"].map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(
    () => resolveExactCompletedPrefix(fakePrisma(rows), "phoenix-release-bundle", report, phase),
    /CONTINUATION_UNEXPECTED_COMPLETED_KEY:wordpress-db:user:39/,
  );
}

async function testExactPrefixRejectsFailedKeyAlreadyComplete(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = fakeReport();
  const rows = [...completedPrefixKeys(), FAILED_KEY].map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(
    () => resolveExactCompletedPrefix(fakePrisma(rows), "phoenix-release-bundle", report, phase),
    /CONTINUATION_FAILED_KEY_ALREADY_COMPLETE/,
  );
}

async function testExactPrefixRejectsDuplicateLineage(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = fakeReport();
  const rows = [...completedPrefixKeys(), "wordpress-db:user:1"].map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(
    () => resolveExactCompletedPrefix(fakePrisma(rows), "phoenix-release-bundle", report, phase),
    /CONTINUATION_DUPLICATE_LINEAGE:wordpress-db:user:1/,
  );
}

async function testExactPrefixRejectsUnrelatedLineage(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = fakeReport();
  const rows = [...completedPrefixKeys(), "wordpress-db:user:99999"].map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(
    () => resolveExactCompletedPrefix(fakePrisma(rows), "phoenix-release-bundle", report, phase),
    /CONTINUATION_UNRELATED_LINEAGE:wordpress-db:user:99999/,
  );
}

async function testExactPrefixRejectsAmbiguousActionInPrefix(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture({ index: 5, action: "SKIP_UNCHANGED" }));
  const report = fakeReport();
  const rows = completedPrefixKeys().map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(
    () => resolveExactCompletedPrefix(fakePrisma(rows), "phoenix-release-bundle", report, phase),
    /CONTINUATION_PREFIX_AMBIGUOUS_ACTION:wordpress-db:user:6/,
  );
}

async function testExactPrefixRejectsUnsupportedPhase(): Promise<void> {
  const phase: PhoenixReleasePhase = { ...usersPhaseFixture(), name: "events" };
  const report = fakeReport({ phase: "events", firstFailure: "wordpress-db:event:1:X" });
  await assert.rejects(
    () => resolveExactCompletedPrefix(fakePrisma([]), "phoenix-release-bundle", report, phase),
    /CONTINUATION_UNSUPPORTED_PHASE:events/,
  );
}

async function testExactPrefixRejectsPhaseMismatch(): Promise<void> {
  const phase: PhoenixReleasePhase = { ...usersPhaseFixture(), name: "places" };
  const report = fakeReport({ phase: "users" });
  await assert.rejects(
    () => resolveExactCompletedPrefix(fakePrisma([]), "phoenix-release-bundle", report, phase),
    /CONTINUATION_PHASE_MISMATCH/,
  );
}

async function testExactPrefixRejectsFailedKeyNotInManifest(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = fakeReport({ firstFailure: "wordpress-db:user:999999:UNEXPECTED_PLAN_ACTION:CREATE" });
  await assert.rejects(
    () => resolveExactCompletedPrefix(fakePrisma([]), "phoenix-release-bundle", report, phase),
    /CONTINUATION_FAILED_KEY_NOT_IN_MANIFEST/,
  );
}

// The report count may be lower than the current proven prefix, as long as
// the live prefix itself remains exact — the defining behavior that lets a
// later, smaller chained-continuation report still safely resume.
async function testExactPrefixAllowsReportCountLowerThanProvenPrefix(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = fakeReport({ created: 0, updated: 0 });
  const rows = completedPrefixKeys().map((sourceRecordKey) => ({ sourceRecordKey }));
  const resolved = await resolveExactCompletedPrefix(fakePrisma(rows), "phoenix-release-bundle", report, phase);
  assert.equal(resolved.alreadyCompleted.size, 20);
}

async function testExactPrefixRejectsReportCountExceedingProvenPrefix(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = fakeReport({ created: 21, updated: 0 });
  const rows = completedPrefixKeys().map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(
    () => resolveExactCompletedPrefix(fakePrisma(rows), "phoenix-release-bundle", report, phase),
    /CONTINUATION_REPORT_COUNT_EXCEEDS_PREFIX:reported=21:prefix=20/,
  );
}

// =============================================================================
// Section 4 — narrow release action exception (wordpress-db:user:38)
// =============================================================================

function testReleaseExceptionCorrectsUser38Action(): void {
  const phase = usersPhaseFixture();
  const corrected = applyReleaseActionExceptions(phase);
  const record = corrected.records.find((r) => r.sourceRecordKey === FAILED_KEY);
  assert.equal(record?.action, "CREATE");
  // Every other record is untouched.
  for (const record of corrected.records) {
    if (record.sourceRecordKey === FAILED_KEY) continue;
    assert.equal(record.action, "CREATE");
  }
}

function testReleaseExceptionFailsClosedOnStaleManifestAction(): void {
  const phase = usersPhaseFixture({ index: 20, action: "CREATE" }); // already CREATE, not the expected SKIP_UNCHANGED
  assert.throws(() => applyReleaseActionExceptions(phase), /CONTINUATION_RELEASE_EXCEPTION_STALE:wordpress-db:user:38/);
}

function testReleaseExceptionNoOpOutsideUsersPhase(): void {
  const phase: PhoenixReleasePhase = { ...usersPhaseFixture(), name: "places" };
  const corrected = applyReleaseActionExceptions(phase);
  assert.deepEqual(corrected, phase);
}

function testReleaseExceptionRegistryIsExactlyOneNarrowEntry(): void {
  assert.equal(PHOENIX_RELEASE_ACTION_EXCEPTIONS.length, 1);
  assert.equal(PHOENIX_RELEASE_ACTION_EXCEPTIONS[0].sourceRecordKey, FAILED_KEY);
}

// =============================================================================
// extractFailedKey / buildContinuationEvidence
// =============================================================================

function testExtractFailedKeyStripsMultiColonErrorSuffix(): void {
  const report = fakeReport({ firstFailure: "wordpress-db:user:38:UNEXPECTED_PLAN_ACTION:CREATE" });
  assert.equal(extractFailedKey(report), FAILED_KEY);
}

function testExtractFailedKeyRejectsNonFailure(): void {
  assert.throws(() => extractFailedKey(fakeReport({ failed: 0, firstFailure: null })), /CONTINUATION_REPORT_NOT_A_FAILURE/);
}

function testBuildContinuationEvidenceShape(): void {
  const evidence = buildContinuationEvidence({
    predecessorCodeSha: PREDECESSOR_CODE_SHA,
    predecessorReportSha256: "a".repeat(64),
    predecessorTerminalFailedKey: FAILED_KEY,
    skippedCompletedPrefixCount: 20,
    continuationStartKey: FAILED_KEY,
  });
  assert.deepEqual(evidence, {
    continuationPredecessorCodeSha: PREDECESSOR_CODE_SHA,
    continuationPredecessorReportSha256: "a".repeat(64),
    continuationPredecessorTerminalFailedKey: FAILED_KEY,
    continuationSkippedCompletedPrefixCount: "20",
    continuationStartKey: FAILED_KEY,
  });
}

async function main(): Promise<void> {
  testCrossShaAcceptsExactExplicitAuthorization();
  testCrossShaRejectsUnknownPredecessorCodeSha();
  testCrossShaRejectsWrongReportSha256();
  testCrossShaRejectsReportCodeShaDisagreement();
  testCrossShaRejectsCurrentCodeShaEqualToPredecessor();
  testCrossShaRejectsIdentityMismatches();
  testCrossShaRejectsNonFailureReport();
  testCrossShaRejectsMalformedEmptyMultiLineOrUnreadableReport();

  await testExactPrefixContinuesDirectlyAtUser38();
  await testExactPrefixRejectsMissingKeyInsidePrefix();
  await testExactPrefixRejectsCompletedKeyAfterFailedKey();
  await testExactPrefixRejectsFailedKeyAlreadyComplete();
  await testExactPrefixRejectsDuplicateLineage();
  await testExactPrefixRejectsUnrelatedLineage();
  await testExactPrefixRejectsAmbiguousActionInPrefix();
  await testExactPrefixRejectsUnsupportedPhase();
  await testExactPrefixRejectsPhaseMismatch();
  await testExactPrefixRejectsFailedKeyNotInManifest();
  await testExactPrefixAllowsReportCountLowerThanProvenPrefix();
  await testExactPrefixRejectsReportCountExceedingProvenPrefix();

  testReleaseExceptionCorrectsUser38Action();
  testReleaseExceptionFailsClosedOnStaleManifestAction();
  testReleaseExceptionNoOpOutsideUsersPhase();
  testReleaseExceptionRegistryIsExactlyOneNarrowEntry();

  testExtractFailedKeyStripsMultiColonErrorSuffix();
  testExtractFailedKeyRejectsNonFailure();
  testBuildContinuationEvidenceShape();

  console.log("Phoenix continuation tests: OK");
}

void main();

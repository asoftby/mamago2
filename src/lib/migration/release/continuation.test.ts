import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  KNOWN_PREDECESSOR_CODE_SHAS,
  PHOENIX_RELEASE_ACTION_EXCEPTIONS,
  PHOENIX_SECOND_HOP_PREDECESSOR_REPORT_SHA256,
  applyReleaseActionExceptions,
  evaluateContinuationAwarePlan,
  assertPhoenixPlaceCityPrerequisites,
  buildContinuationEvidence,
  extractFailedKey,
  loadCrossShaContinuationChain,
  resolveChainOriginCodeSha,
  resolveExactCompletedPrefix,
  resolveFullPhaseCompletion,
  resolveMultiPhaseContinuation,
} from "./continuation";
import { exactExecutableKeys, loadPhoenixReleaseManifest, sha256Bytes } from "./manifest";
import type { PhoenixEnvironmentContext, PhoenixPhaseName, PhoenixPhaseReport, PhoenixReleaseManifest, PhoenixReleasePhase } from "./types";

const PREDECESSOR_CODE_SHA = "f466c34c0cf095d054ae79d86a12505129719739";
const SECOND_HOP_PREDECESSOR_CODE_SHA = "2dc00b6026651c0d1b1008598a19a6833930820f";
const NEW_CODE_SHA = "b".repeat(40);
const RELEASE_ID = "phoenix-approved-test";
const MANIFEST_HASH = "manifest-hash";

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

function tempReportPath(content: string): string {
  const root = mkdtempSync(join(tmpdir(), "phoenix-continuation-test-"));
  const path = join(root, "dev.jsonl");
  writeFileSync(path, content);
  return path;
}

function fakePrisma(rows: Array<{ sourceRecordKey: string }>) {
  return {
    migrationLineage: {
      findMany: async () => rows,
    },
  } as unknown as import("@prisma/client").PrismaClient;
}

// =============================================================================
// Fixtures — three phases shaped after the real manifest: users (25 keys,
// wordpress-db:user:38 at index 20, SKIP_UNCHANGED per the real stale
// manifest declaration), businesses (10 keys), places (6 keys, the failing
// wordpress-db:places:5528 at index 3, exactly like the real DEV state).
// =============================================================================

const FAILED_USER_KEY = "wordpress-db:user:38";
const FAILED_PLACE_KEY = "wordpress-db:places:5528";

function usersPhaseFixture(overrideAction?: { index: number; action: PhoenixReleasePhase["records"][number]["action"] }): PhoenixReleasePhase {
  const before = Array.from({ length: 20 }, (_, i) => `wordpress-db:user:${i + 1}`);
  const after = Array.from({ length: 4 }, (_, i) => `wordpress-db:user:${i + 39}`);
  const keys = [...before, FAILED_USER_KEY, ...after];
  const records = keys.map((sourceRecordKey) => ({
    sourceRecordKey,
    action: (sourceRecordKey === FAILED_USER_KEY ? "SKIP_UNCHANGED" : "CREATE") as PhoenixReleasePhase["records"][number]["action"],
  }));
  if (overrideAction) records[overrideAction.index] = { ...records[overrideAction.index], action: overrideAction.action };
  return {
    name: "users", status: "READY", artifacts: [], records,
    protectedSourceRecordKeys: [], excludedSourceRecordKeys: [], deterministicConflicts: [],
    mediaPolicy: "NOT_APPLICABLE", prerequisites: [],
  };
}

function businessesPhaseFixture(): PhoenixReleasePhase {
  const records = Array.from({ length: 10 }, (_, i) => ({
    sourceRecordKey: `wordpress-db:user:${i + 1}`,
    action: "CREATE" as const,
  }));
  return {
    name: "businesses", status: "READY", artifacts: [], records,
    protectedSourceRecordKeys: [], excludedSourceRecordKeys: [], deterministicConflicts: [],
    mediaPolicy: "NOT_APPLICABLE", prerequisites: [],
  };
}

function placesPhaseFixture(): PhoenixReleasePhase {
  const before = ["wordpress-db:places:5457", "wordpress-db:places:5492", "wordpress-db:places:5515"];
  const after = ["wordpress-db:places:5579", "wordpress-db:places:5594"];
  const keys = [...before, FAILED_PLACE_KEY, ...after];
  const records = keys.map((sourceRecordKey) => ({ sourceRecordKey, action: "CREATE" as const }));
  return {
    name: "places", status: "READY", artifacts: [], records,
    protectedSourceRecordKeys: [], excludedSourceRecordKeys: [], deterministicConflicts: [],
    mediaPolicy: "METADATA", prerequisites: [],
  };
}

function testManifest(phases: PhoenixReleasePhase[] = [usersPhaseFixture(), businessesPhaseFixture(), placesPhaseFixture()]): PhoenixReleaseManifest {
  return { schemaVersion: 1, releaseId: RELEASE_ID, phaseOrder: phases.map((p) => p.name), phases };
}

function usersKeys(): string[] {
  return usersPhaseFixture().records.map((r) => r.sourceRecordKey);
}
function businessesKeys(): string[] {
  return businessesPhaseFixture().records.map((r) => r.sourceRecordKey);
}
function placesPrefixKeys(): string[] {
  return placesPhaseFixture().records.slice(0, 3).map((r) => r.sourceRecordKey);
}

function baseReport(overrides: Partial<PhoenixPhaseReport> = {}): PhoenixPhaseReport {
  return {
    releaseId: RELEASE_ID,
    environment: "DEV",
    codeSha: PREDECESSOR_CODE_SHA,
    manifestPath: "manifest.json",
    manifestHash: MANIFEST_HASH,
    phase: "users",
    attempted: 0, created: 0, updated: 0, skipped: 0, protectedConflicts: 0, failed: 0,
    targetCountDelta: 0, migrationRecordDelta: 0, migrationLineageDelta: 0,
    duplicateLineage: 0, duplicateTargets: 0, mediaStorageDelta: 0,
    forbiddenTableAudit: "NOT_RUN",
    firstFailure: null,
    completedPrefix: [],
    environmentFingerprint: environment,
    resolvedIdentities: {},
    ...overrides,
  };
}

// First-hop report: single line, users phase fails at wordpress-db:user:38.
function firstHopFailureReport(): PhoenixPhaseReport {
  return baseReport({
    phase: "users",
    attempted: 21, created: 20, updated: 0, failed: 1,
    firstFailure: "wordpress-db:user:38:UNEXPECTED_PLAN_ACTION:CREATE",
  });
}

// Second-hop chain: users success, businesses success, places fails at 5528 —
// exactly the shape of the real dev-continuation-2dc00b602665.jsonl.
function secondHopChain(): PhoenixPhaseReport[] {
  const usersSuccess = baseReport({
    codeSha: SECOND_HOP_PREDECESSOR_CODE_SHA,
    phase: "users", attempted: 25, created: 5, updated: 0, skipped: 20, failed: 0,
    completedPrefix: ["users"],
    resolvedIdentities: {
      continuationPredecessorCodeSha: PREDECESSOR_CODE_SHA,
      continuationPredecessorReportSha256: "a".repeat(64),
      continuationPredecessorTerminalFailedKey: FAILED_USER_KEY,
      continuationSkippedCompletedPrefixCount: "20",
      continuationStartKey: FAILED_USER_KEY,
      continuationChainOriginCodeSha: PREDECESSOR_CODE_SHA,
    },
  });
  const businessesSuccess = baseReport({
    codeSha: SECOND_HOP_PREDECESSOR_CODE_SHA,
    phase: "businesses", attempted: 10, created: 10, updated: 0, failed: 0,
    completedPrefix: ["users", "businesses"],
  });
  const placesFailure = baseReport({
    codeSha: SECOND_HOP_PREDECESSOR_CODE_SHA,
    phase: "places", attempted: 4, created: 3, updated: 0, failed: 1,
    completedPrefix: ["users", "businesses"],
    firstFailure: `${FAILED_PLACE_KEY}:PLACE_CITY_DEPENDENCY_NOT_FOUND`,
  });
  return [usersSuccess, businessesSuccess, placesFailure];
}

function reportRequest(entries: PhoenixPhaseReport[], overrides: Partial<{ reportSha256: string; predecessorCodeSha: string }> = {}) {
  const raw = `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;
  return {
    reportPath: tempReportPath(raw),
    reportSha256: overrides.reportSha256 ?? sha256Bytes(raw),
    predecessorCodeSha: overrides.predecessorCodeSha ?? entries[0].codeSha,
  };
}

const expectedFirstHop = { releaseId: RELEASE_ID, manifestHash: MANIFEST_HASH, currentCodeSha: SECOND_HOP_PREDECESSOR_CODE_SHA, environment, manifest: testManifest() };
const expectedSecondHop = { releaseId: RELEASE_ID, manifestHash: MANIFEST_HASH, currentCodeSha: NEW_CODE_SHA, environment, manifest: testManifest() };

// =============================================================================
// loadCrossShaContinuationChain
// =============================================================================

function testFirstHopChainAcceptsZeroPriorPhases(): void {
  const chain = loadCrossShaContinuationChain(reportRequest([firstHopFailureReport()]), expectedFirstHop);
  assert.equal(chain.priorPhaseReports.length, 0);
  assert.equal(chain.failureReport.phase, "users");
}

function testSecondHopRejectsAnyUnpinnedReportArtifact(): void {
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest(secondHopChain()), { ...expectedSecondHop, releaseId: "phoenix-approved-2026-07-30" }),
    /CONTINUATION_PREDECESSOR_REPORT_NOT_AUTHORIZED/,
  );
  assert.equal(PHOENIX_SECOND_HOP_PREDECESSOR_REPORT_SHA256, "257671d8dd039d803d5571cdcd0d00a8ddbdeaf4fba55c1a21b4f35850a9cfcc");
}

function testChainRejectsUnknownPredecessorCodeSha(): void {
  const unknownSha = "1".repeat(40);
  const entries = [{ ...firstHopFailureReport(), codeSha: unknownSha }];
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest(entries, { predecessorCodeSha: unknownSha }), expectedFirstHop),
    /CONTINUATION_PREDECESSOR_CODE_SHA_UNKNOWN/,
  );
  assert(!KNOWN_PREDECESSOR_CODE_SHAS.has(unknownSha));
}

function testChainRejectsWrongReportSha256(): void {
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest([firstHopFailureReport()], { reportSha256: "0".repeat(64) }), expectedFirstHop),
    /CONTINUATION_REPORT_SHA256_MISMATCH/,
  );
}

function testChainRejectsFailureLineCodeShaDisagreement(): void {
  const entries = [{ ...firstHopFailureReport(), codeSha: "c".repeat(40) }];
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest(entries, { predecessorCodeSha: PREDECESSOR_CODE_SHA }), expectedFirstHop),
    /CONTINUATION_REPORT_CODE_SHA_MISMATCH/,
  );
}

function testChainRejectsCurrentEqualsPredecessor(): void {
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest([firstHopFailureReport()]), { ...expectedFirstHop, currentCodeSha: PREDECESSOR_CODE_SHA }),
    /CONTINUATION_CODE_SHA_UNCHANGED/,
  );
}

function testChainRejectsFailureLineIdentityMismatches(): void {
  const raw = (overrides: Partial<PhoenixPhaseReport>) => [{ ...firstHopFailureReport(), ...overrides }];
  assert.throws(() => loadCrossShaContinuationChain(reportRequest(raw({ releaseId: "other" })), expectedFirstHop), /CONTINUATION_RELEASE_ID_MISMATCH/);
  assert.throws(() => loadCrossShaContinuationChain(reportRequest(raw({ manifestHash: "other" })), expectedFirstHop), /CONTINUATION_MANIFEST_HASH_MISMATCH/);
  assert.throws(() => loadCrossShaContinuationChain(reportRequest(raw({ environment: "PROD" })), expectedFirstHop), /CONTINUATION_ENVIRONMENT_MISMATCH/);
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest(raw({ environmentFingerprint: { ...environment, database: { ...environment.database, host: "other" } } })), expectedFirstHop),
    /CONTINUATION_ENVIRONMENT_FINGERPRINT_MISMATCH/,
  );
}

function testChainRejectsNonFailureLastLine(): void {
  const entries = [{ ...firstHopFailureReport(), failed: 0, firstFailure: null }];
  assert.throws(() => loadCrossShaContinuationChain(reportRequest(entries), expectedFirstHop), /CONTINUATION_REPORT_NOT_A_FAILURE/);
}

function testChainRejectsMalformedEmptyOrUnreadableReport(): void {
  const expected = expectedFirstHop;
  assert.throws(
    () => loadCrossShaContinuationChain({ reportPath: tempReportPath("not json\n"), reportSha256: sha256Bytes("not json\n"), predecessorCodeSha: PREDECESSOR_CODE_SHA }, expected),
    /CONTINUATION_REPORT_MALFORMED/,
  );
  assert.throws(
    () => loadCrossShaContinuationChain({ reportPath: tempReportPath(""), reportSha256: sha256Bytes(""), predecessorCodeSha: PREDECESSOR_CODE_SHA }, expected),
    /CONTINUATION_REPORT_EMPTY/,
  );
  assert.throws(
    () => loadCrossShaContinuationChain({ reportPath: "/nonexistent/dev.jsonl", reportSha256: "0".repeat(64), predecessorCodeSha: PREDECESSOR_CODE_SHA }, expected),
    /CONTINUATION_REPORT_UNREADABLE/,
  );
}

function testChainRejectsPriorPhaseCountMismatch(): void {
  // Only "users" supplied as a prior line, but the failure is in "places" —
  // "businesses" is missing from the chain entirely.
  const [usersSuccess, , placesFailure] = secondHopChain();
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest([usersSuccess, placesFailure]), expectedSecondHop),
    /CONTINUATION_PRIOR_PHASE_COUNT_MISMATCH/,
  );
}

function testChainRejectsPriorPhaseOrderMismatch(): void {
  const [usersSuccess, businessesSuccess, placesFailure] = secondHopChain();
  const reordered = { ...usersSuccess, phase: "businesses" as const };
  const reorderedBusinesses = { ...businessesSuccess, phase: "users" as const };
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest([reordered, reorderedBusinesses, placesFailure]), expectedSecondHop),
    /CONTINUATION_PRIOR_PHASE_ORDER_MISMATCH/,
  );
}

function testChainRejectsPriorPhaseNotSuccessful(): void {
  const [usersSuccess, businessesSuccess, placesFailure] = secondHopChain();
  const businessesActuallyFailed = { ...businessesSuccess, failed: 1 };
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest([usersSuccess, businessesActuallyFailed, placesFailure]), expectedSecondHop),
    /CONTINUATION_PRIOR_PHASE_NOT_SUCCESSFUL:businesses/,
  );
}

function testChainRejectsPriorPhasePrefixCorrupted(): void {
  const [usersSuccess, businessesSuccess, placesFailure] = secondHopChain();
  const corrupted = { ...businessesSuccess, completedPrefix: ["users", "businesses", "places"] as PhoenixPhaseName[] };
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest([usersSuccess, corrupted, placesFailure]), expectedSecondHop),
    /CONTINUATION_PRIOR_PHASE_PREFIX_CORRUPTED:businesses/,
  );
}

function testChainRejectsPriorPhaseCodeShaDisagreement(): void {
  const [usersSuccess, businessesSuccess, placesFailure] = secondHopChain();
  const wrongCodeSha = { ...businessesSuccess, codeSha: "d".repeat(40) };
  assert.throws(
    () => loadCrossShaContinuationChain(reportRequest([usersSuccess, wrongCodeSha, placesFailure], { predecessorCodeSha: SECOND_HOP_PREDECESSOR_CODE_SHA }), expectedSecondHop),
    /CONTINUATION_REPORT_CODE_SHA_MISMATCH/,
  );
}

function testChainCorrectlySkipsValidationOnlyPhaseInSequence(): void {
  // A VALIDATION_ONLY phase positioned before the failure must never be
  // expected to have its own report line — mirrors runPhoenixRelease's own
  // `continue` behavior for such phases in apply/rerun mode.
  const manifestWithValidationOnly: PhoenixReleaseManifest = {
    schemaVersion: 1,
    releaseId: RELEASE_ID,
    phaseOrder: ["users", "redirects", "businesses"],
    phases: [
      usersPhaseFixture(),
      { ...businessesPhaseFixture(), name: "redirects", status: "VALIDATION_ONLY" },
      { ...businessesPhaseFixture() },
    ],
  };
  const usersSuccess = baseReport({ phase: "users", failed: 0, completedPrefix: ["users"] });
  const businessesFailure = baseReport({
    phase: "businesses",
    failed: 1,
    completedPrefix: ["users"],
    firstFailure: "wordpress-db:user:1:SOME_ERROR",
  });
  const chain = loadCrossShaContinuationChain(
    reportRequest([usersSuccess, businessesFailure]),
    { releaseId: RELEASE_ID, manifestHash: MANIFEST_HASH, currentCodeSha: NEW_CODE_SHA, environment, manifest: manifestWithValidationOnly },
  );
  assert.equal(chain.priorPhaseReports.length, 1);
  assert.equal(chain.priorPhaseReports[0].phase, "users");
}

// =============================================================================
// resolveExactCompletedPrefix (single failing phase, partial prefix)
// =============================================================================

async function testExactPrefixContinuesDirectlyAtFailedKey(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const rows = usersKeys().slice(0, 20).map((sourceRecordKey) => ({ sourceRecordKey }));
  const resolved = await resolveExactCompletedPrefix(fakePrisma(rows), "ns", firstHopFailureReport(), phase);
  assert.equal(resolved.continuationStartKey, FAILED_USER_KEY);
  assert.equal(resolved.alreadyCompleted.size, 20);
}

async function testExactPrefixRejectsMissingKey(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const rows = usersKeys().slice(0, 20).filter((k) => k !== "wordpress-db:user:5").map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(() => resolveExactCompletedPrefix(fakePrisma(rows), "ns", firstHopFailureReport(), phase), /CONTINUATION_PREFIX_KEY_MISSING/);
}

async function testExactPrefixRejectsNonPrefixKey(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const rows = [...usersKeys().slice(0, 20), "wordpress-db:user:39"].map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(() => resolveExactCompletedPrefix(fakePrisma(rows), "ns", firstHopFailureReport(), phase), /CONTINUATION_UNEXPECTED_COMPLETED_KEY/);
}

async function testExactPrefixRejectsFailedKeyAlreadyComplete(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const rows = [...usersKeys().slice(0, 20), FAILED_USER_KEY].map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(() => resolveExactCompletedPrefix(fakePrisma(rows), "ns", firstHopFailureReport(), phase), /CONTINUATION_FAILED_KEY_ALREADY_COMPLETE/);
}

async function testExactPrefixRejectsDuplicateLineage(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const rows = [...usersKeys().slice(0, 20), "wordpress-db:user:1"].map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(() => resolveExactCompletedPrefix(fakePrisma(rows), "ns", firstHopFailureReport(), phase), /CONTINUATION_DUPLICATE_LINEAGE/);
}

async function testExactPrefixRejectsUnrelatedLineage(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const rows = [...usersKeys().slice(0, 20), "wordpress-db:user:99999"].map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(() => resolveExactCompletedPrefix(fakePrisma(rows), "ns", firstHopFailureReport(), phase), /CONTINUATION_UNRELATED_LINEAGE/);
}

async function testExactPrefixRejectsAmbiguousAction(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture({ index: 5, action: "SKIP_UNCHANGED" }));
  const rows = usersKeys().slice(0, 20).map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(() => resolveExactCompletedPrefix(fakePrisma(rows), "ns", firstHopFailureReport(), phase), /CONTINUATION_PREFIX_AMBIGUOUS_ACTION/);
}

async function testExactPrefixAllowsReportCountLowerThanProvenPrefix(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = { ...firstHopFailureReport(), created: 0, updated: 0 };
  const rows = usersKeys().slice(0, 20).map((sourceRecordKey) => ({ sourceRecordKey }));
  const resolved = await resolveExactCompletedPrefix(fakePrisma(rows), "ns", report, phase);
  assert.equal(resolved.alreadyCompleted.size, 20);
}

async function testExactPrefixRejectsReportCountExceedingProvenPrefix(): Promise<void> {
  const phase = applyReleaseActionExceptions(usersPhaseFixture());
  const report = { ...firstHopFailureReport(), created: 21, updated: 0 };
  const rows = usersKeys().slice(0, 20).map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(() => resolveExactCompletedPrefix(fakePrisma(rows), "ns", report, phase), /CONTINUATION_REPORT_COUNT_EXCEEDS_PREFIX/);
}

// =============================================================================
// resolveFullPhaseCompletion (a phase that must be 100% done)
// =============================================================================

async function testFullPhaseCompletionSucceedsOnExactMatch(): Promise<void> {
  const phase = businessesPhaseFixture();
  const rows = businessesKeys().map((sourceRecordKey) => ({ sourceRecordKey }));
  const result = await resolveFullPhaseCompletion(fakePrisma(rows), "ns", phase);
  assert.equal(result.size, 10);
}

async function testFullPhaseCompletionRejectsMissingKey(): Promise<void> {
  const phase = businessesPhaseFixture();
  const rows = businessesKeys().slice(0, 9).map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(() => resolveFullPhaseCompletion(fakePrisma(rows), "ns", phase), /CONTINUATION_PREFIX_KEY_MISSING/);
}

async function testFullPhaseCompletionRejectsUnrelatedKey(): Promise<void> {
  const phase = businessesPhaseFixture();
  const rows = [...businessesKeys(), "wordpress-db:user:99999"].map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(() => resolveFullPhaseCompletion(fakePrisma(rows), "ns", phase), /CONTINUATION_UNRELATED_LINEAGE/);
}

async function testFullPhaseCompletionRejectsDuplicateLineage(): Promise<void> {
  const phase = businessesPhaseFixture();
  const rows = [...businessesKeys(), businessesKeys()[0]].map((sourceRecordKey) => ({ sourceRecordKey }));
  await assert.rejects(() => resolveFullPhaseCompletion(fakePrisma(rows), "ns", phase), /CONTINUATION_DUPLICATE_LINEAGE/);
}

// =============================================================================
// resolveMultiPhaseContinuation — the full second-hop orchestration
// =============================================================================

async function testMultiPhaseContinuationResolvesExactSecondHopScenario(): Promise<void> {
  const manifest = testManifest();
  const correctedManifest: PhoenixReleaseManifest = { ...manifest, phases: manifest.phases.map(applyReleaseActionExceptions) };
  const entries = secondHopChain();
  const chain = { priorPhaseReports: entries.slice(0, -1), failureReport: entries.at(-1)! };

  const allRows = [
    ...usersKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "USER" })),
    ...businessesKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "BUSINESS" })),
    ...placesPrefixKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "PLACE" })),
  ];
  const prisma = {
    migrationLineage: {
      findMany: async (args: { where: { targetType: string } }) =>
        allRows.filter((r) => r.targetType === args.where.targetType).map((r) => ({ sourceRecordKey: r.sourceRecordKey })),
    },
  } as unknown as import("@prisma/client").PrismaClient;

  const result = await resolveMultiPhaseContinuation(prisma, "ns", chain, correctedManifest);
  assert.equal(result.failedPhase, "places");
  assert.equal(result.continuationStartKey, FAILED_PLACE_KEY);
  assert.equal(result.phaseSkipSets.get("users")?.size, 25, "users phase is skipped in FULL — every executable key");
  assert.equal(result.phaseSkipSets.get("businesses")?.size, 10, "businesses phase is skipped in FULL");
  assert.deepEqual([...(result.phaseSkipSets.get("places") ?? [])].sort(), placesPrefixKeys().sort(), "places phase is skipped only up to its exact partial prefix");
}

async function testMultiPhaseContinuationFailsClosedWhenPriorPhaseNotActuallyComplete(): Promise<void> {
  const manifest = testManifest();
  const correctedManifest: PhoenixReleaseManifest = { ...manifest, phases: manifest.phases.map(applyReleaseActionExceptions) };
  const entries = secondHopChain();
  const chain = { priorPhaseReports: entries.slice(0, -1), failureReport: entries.at(-1)! };

  // businesses claims to be fully complete (10/10) but live DB only shows 9 —
  // the report chain's own success claim must never be trusted blindly.
  const allRows = [
    ...usersKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "USER" })),
    ...businessesKeys().slice(0, 9).map((sourceRecordKey) => ({ sourceRecordKey, targetType: "BUSINESS" })),
    ...placesPrefixKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "PLACE" })),
  ];
  const prisma = {
    migrationLineage: {
      findMany: async (args: { where: { targetType: string } }) =>
        allRows.filter((r) => r.targetType === args.where.targetType).map((r) => ({ sourceRecordKey: r.sourceRecordKey })),
    },
  } as unknown as import("@prisma/client").PrismaClient;

  await assert.rejects(() => resolveMultiPhaseContinuation(prisma, "ns", chain, correctedManifest), /CONTINUATION_PREFIX_KEY_MISSING/);
}

function laterPhase(name: PhoenixPhaseName, sourceRecordKey: string): PhoenixReleasePhase {
  return {
    name, status: "READY", artifacts: [], records: [{ sourceRecordKey, action: "CREATE" }],
    protectedSourceRecordKeys: [], excludedSourceRecordKeys: [], deterministicConflicts: [],
    mediaPolicy: "NOT_APPLICABLE", prerequisites: [],
  };
}

async function testContinuationAwarePlanIsReadOnlyAndAggregatesCurrentCityBlockers(): Promise<void> {
  const manifest = testManifest([
    usersPhaseFixture(), businessesPhaseFixture(), placesPhaseFixture(),
    laterPhase("offers", "wordpress-db:offers:1"),
    laterPhase("routes", "wordpress-db:routes:1"),
    laterPhase("events", "wordpress-db:events:1"),
    laterPhase("articles", "wordpress-db:articles:1"),
  ]);
  const correctedManifest: PhoenixReleaseManifest = { ...manifest, phases: manifest.phases.map(applyReleaseActionExceptions) };
  const entries = secondHopChain();
  const rows = [
    ...usersKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "USER" })),
    ...businessesKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "BUSINESS" })),
    ...placesPrefixKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "PLACE" })),
  ];
  const calls: string[] = [];
  const prisma = {
    migrationLineage: { findMany: async (args: { where: { targetType: string } }) => {
      calls.push(`migrationLineage.findMany:${args.where.targetType}`);
      return rows.filter((row) => row.targetType === args.where.targetType).map(({ sourceRecordKey }) => ({ sourceRecordKey }));
    } },
    city: { findMany: async () => { calls.push("city.findMany"); return []; } },
  } as unknown as import("@prisma/client").PrismaClient;

  const result = await evaluateContinuationAwarePlan({
    prisma,
    request: { reportPath: "/read-only/predecessor.jsonl", reportSha256: "a".repeat(64), predecessorCodeSha: SECOND_HOP_PREDECESSOR_CODE_SHA },
    expected: { ...expectedSecondHop, manifest: correctedManifest },
    chain: { priorPhaseReports: entries.slice(0, -1), failureReport: entries.at(-1)! },
  });

  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(result.cityPrerequisites, { missing: ["Копище", "Мир"], ambiguous: [] });
  assert.equal(result.completed.users?.length, 25);
  assert.equal(result.completed.businesses?.length, 10);
  assert.deepEqual(result.completed.places, placesPrefixKeys());
  assert.equal(result.continuationStartKey, FAILED_PLACE_KEY);
  assert.equal(result.laterPhasesUntouched, true);
  assert.equal(result.writesAttempted, 0);
  assert.deepEqual(calls, [
    "migrationLineage.findMany:USER", "migrationLineage.findMany:BUSINESS", "migrationLineage.findMany:PLACE",
    "migrationLineage.findMany:OFFER", "migrationLineage.findMany:ROUTE", "migrationLineage.findMany:ACTIVITY",
    "migrationLineage.findMany:ARTICLE", "city.findMany",
  ]);
}

async function testContinuationAwarePlanRejectsTouchedLaterPhaseBeforeCityCheck(): Promise<void> {
  const manifest = testManifest([
    usersPhaseFixture(), businessesPhaseFixture(), placesPhaseFixture(), laterPhase("offers", "wordpress-db:offers:1"),
  ]);
  const correctedManifest: PhoenixReleaseManifest = { ...manifest, phases: manifest.phases.map(applyReleaseActionExceptions) };
  const entries = secondHopChain();
  const rows = [
    ...usersKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "USER" })),
    ...businessesKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "BUSINESS" })),
    ...placesPrefixKeys().map((sourceRecordKey) => ({ sourceRecordKey, targetType: "PLACE" })),
    { sourceRecordKey: "wordpress-db:offers:1", targetType: "OFFER" },
  ];
  let cityRead = false;
  const prisma = {
    migrationLineage: { findMany: async (args: { where: { targetType: string } }) =>
      rows.filter((row) => row.targetType === args.where.targetType).map(({ sourceRecordKey }) => ({ sourceRecordKey })) },
    city: { findMany: async () => { cityRead = true; return []; } },
  } as unknown as import("@prisma/client").PrismaClient;
  await assert.rejects(() => evaluateContinuationAwarePlan({
    prisma,
    request: { reportPath: "unused", reportSha256: "a".repeat(64), predecessorCodeSha: SECOND_HOP_PREDECESSOR_CODE_SHA },
    expected: { ...expectedSecondHop, manifest: correctedManifest },
    chain: { priorPhaseReports: entries.slice(0, -1), failureReport: entries.at(-1)! },
  }), /CONTINUATION_LATER_PHASE_TOUCHED:offers/);
  assert.equal(cityRead, false);
}

async function testContinuationAwarePlanProvesExactApprovedManifestBoundary(): Promise<void> {
  const { manifest, manifestHash } = loadPhoenixReleaseManifest(
    "docs/migration/releases/phoenix-approved-2026-07-30.json",
  );
  const correctedManifest: PhoenixReleaseManifest = { ...manifest, phases: manifest.phases.map(applyReleaseActionExceptions) };
  const keys = (name: PhoenixPhaseName) => exactExecutableKeys(correctedManifest.phases.find((phase) => phase.name === name)!);
  const rows = [
    ...keys("users").map((sourceRecordKey) => ({ sourceRecordKey, targetType: "USER" })),
    ...keys("businesses").map((sourceRecordKey) => ({ sourceRecordKey, targetType: "BUSINESS" })),
    ...["wordpress-db:places:5457", "wordpress-db:places:5492", "wordpress-db:places:5515"]
      .map((sourceRecordKey) => ({ sourceRecordKey, targetType: "PLACE" })),
  ];
  const entries = secondHopChain().map((entry) => ({
    ...entry, releaseId: manifest.releaseId, manifestHash,
  }));
  const prisma = {
    migrationLineage: { findMany: async (args: { where: { targetType: string } }) =>
      rows.filter((row) => row.targetType === args.where.targetType).map(({ sourceRecordKey }) => ({ sourceRecordKey })) },
    city: { findMany: async () => [] },
  } as unknown as import("@prisma/client").PrismaClient;
  const result = await evaluateContinuationAwarePlan({
    prisma,
    request: { reportPath: "read-only", reportSha256: "a".repeat(64), predecessorCodeSha: SECOND_HOP_PREDECESSOR_CODE_SHA },
    expected: { ...expectedSecondHop, releaseId: manifest.releaseId, manifestHash, manifest: correctedManifest },
    chain: { priorPhaseReports: entries.slice(0, -1), failureReport: entries.at(-1)! },
  });
  assert.equal(result.completed.users?.length, 563);
  assert.equal(result.completed.businesses?.length, 38);
  assert.deepEqual(result.completed.places, [
    "wordpress-db:places:5457", "wordpress-db:places:5492", "wordpress-db:places:5515",
  ]);
  assert.equal(result.continuationStartKey, "wordpress-db:places:5528");
}

// =============================================================================
// applyReleaseActionExceptions
// =============================================================================

function testReleaseExceptionCorrectsUser38Action(): void {
  const corrected = applyReleaseActionExceptions(usersPhaseFixture());
  assert.equal(corrected.records.find((r) => r.sourceRecordKey === FAILED_USER_KEY)?.action, "CREATE");
}

function testReleaseExceptionFailsClosedOnStaleManifestAction(): void {
  const phase = usersPhaseFixture({ index: 20, action: "CREATE" });
  assert.throws(() => applyReleaseActionExceptions(phase), /CONTINUATION_RELEASE_EXCEPTION_STALE/);
}

function testReleaseExceptionNoOpOutsideUsersPhase(): void {
  const phase: PhoenixReleasePhase = { ...usersPhaseFixture(), name: "places" };
  assert.deepEqual(applyReleaseActionExceptions(phase), phase);
}

function testReleaseExceptionRegistryDoesNotCoverThePlaceCityFailure(): void {
  // wordpress-db:places:5528/32271 are a missing-prerequisite (City rows
  // absent from DEV), never a manifest/live-plan mismatch — they must never
  // be papered over by this table. See §J/§K.
  assert.equal(PHOENIX_RELEASE_ACTION_EXCEPTIONS.some((e) => e.sourceRecordKey.includes("places")), false);
}

async function testPlaceCityPrerequisitesReportAllMissingBeforeWrite(): Promise<void> {
  const prisma = { city: { findMany: async () => [] } } as never;
  await assert.rejects(
    () => assertPhoenixPlaceCityPrerequisites(prisma),
    /PLACE_CITY_PREREQUISITES_UNSATISFIED:.*Копище.*Мир/,
  );
}

async function testPlaceCityPrerequisitesRejectAmbiguousMatch(): Promise<void> {
  const prisma = { city: { findMany: async () => [
    { id: "1", name: "Копище" }, { id: "2", name: "Копище" }, { id: "3", name: "Мир" },
  ] } } as never;
  await assert.rejects(() => assertPhoenixPlaceCityPrerequisites(prisma), /"ambiguous":\["Копище"\]/);
}

async function testInactiveCityDoesNotSatisfyPrerequisite(): Promise<void> {
  let query: { where?: { isActive?: boolean } } | undefined;
  const prisma = { city: { findMany: async (args: typeof query) => { query = args; return []; } } } as never;
  await assert.rejects(() => assertPhoenixPlaceCityPrerequisites(prisma), /Копище.*Мир/);
  assert.equal(query?.where?.isActive, true);
}

async function testPlaceCityPrerequisitesAcceptExactlyOneEach(): Promise<void> {
  let query: unknown;
  const prisma = { city: { findMany: async (args: unknown) => {
    query = args;
    return [{ id: "1", name: "Копище" }, { id: "2", name: "Мир" }];
  } } } as never;
  await assertPhoenixPlaceCityPrerequisites(prisma);
  assert.deepEqual(query, {
    where: { name: { in: ["Копище", "Мир"], mode: "insensitive" }, isActive: true },
    select: { id: true, name: true },
  });
}

// =============================================================================
// extractFailedKey / buildContinuationEvidence / resolveChainOriginCodeSha
// =============================================================================

function testExtractFailedKeyStripsMultiColonSuffix(): void {
  assert.equal(extractFailedKey(firstHopFailureReport()), FAILED_USER_KEY);
}

function testExtractFailedKeyRejectsNonFailure(): void {
  assert.throws(() => extractFailedKey({ ...firstHopFailureReport(), failed: 0, firstFailure: null }), /CONTINUATION_REPORT_NOT_A_FAILURE/);
}

function testBuildContinuationEvidenceIncludesChainOrigin(): void {
  const evidence = buildContinuationEvidence({
    predecessorCodeSha: SECOND_HOP_PREDECESSOR_CODE_SHA,
    predecessorReportSha256: "a".repeat(64),
    predecessorTerminalFailedKey: FAILED_PLACE_KEY,
    skippedCompletedPrefixCount: 3,
    continuationStartKey: FAILED_PLACE_KEY,
    chainOriginCodeSha: PREDECESSOR_CODE_SHA,
  });
  assert.equal(evidence.continuationChainOriginCodeSha, PREDECESSOR_CODE_SHA);
  assert.equal(evidence.continuationPredecessorCodeSha, SECOND_HOP_PREDECESSOR_CODE_SHA);
}

function testResolveChainOriginCodeShaFirstHopIsItsOwnOrigin(): void {
  const report = firstHopFailureReport();
  assert.equal(resolveChainOriginCodeSha(report, PREDECESSOR_CODE_SHA), PREDECESSOR_CODE_SHA);
}

function testResolveChainOriginCodeShaSecondHopInheritsOrigin(): void {
  const [usersSuccess] = secondHopChain();
  assert.equal(resolveChainOriginCodeSha(usersSuccess, SECOND_HOP_PREDECESSOR_CODE_SHA), PREDECESSOR_CODE_SHA);
}

async function main(): Promise<void> {
  testFirstHopChainAcceptsZeroPriorPhases();
  testSecondHopRejectsAnyUnpinnedReportArtifact();
  testChainRejectsUnknownPredecessorCodeSha();
  testChainRejectsWrongReportSha256();
  testChainRejectsFailureLineCodeShaDisagreement();
  testChainRejectsCurrentEqualsPredecessor();
  testChainRejectsFailureLineIdentityMismatches();
  testChainRejectsNonFailureLastLine();
  testChainRejectsMalformedEmptyOrUnreadableReport();
  testChainRejectsPriorPhaseCountMismatch();
  testChainRejectsPriorPhaseOrderMismatch();
  testChainRejectsPriorPhaseNotSuccessful();
  testChainRejectsPriorPhasePrefixCorrupted();
  testChainRejectsPriorPhaseCodeShaDisagreement();
  testChainCorrectlySkipsValidationOnlyPhaseInSequence();

  await testExactPrefixContinuesDirectlyAtFailedKey();
  await testExactPrefixRejectsMissingKey();
  await testExactPrefixRejectsNonPrefixKey();
  await testExactPrefixRejectsFailedKeyAlreadyComplete();
  await testExactPrefixRejectsDuplicateLineage();
  await testExactPrefixRejectsUnrelatedLineage();
  await testExactPrefixRejectsAmbiguousAction();
  await testExactPrefixAllowsReportCountLowerThanProvenPrefix();
  await testExactPrefixRejectsReportCountExceedingProvenPrefix();

  await testFullPhaseCompletionSucceedsOnExactMatch();
  await testFullPhaseCompletionRejectsMissingKey();
  await testFullPhaseCompletionRejectsUnrelatedKey();
  await testFullPhaseCompletionRejectsDuplicateLineage();

  await testMultiPhaseContinuationResolvesExactSecondHopScenario();
  await testMultiPhaseContinuationFailsClosedWhenPriorPhaseNotActuallyComplete();
  await testContinuationAwarePlanIsReadOnlyAndAggregatesCurrentCityBlockers();
  await testContinuationAwarePlanRejectsTouchedLaterPhaseBeforeCityCheck();
  await testContinuationAwarePlanProvesExactApprovedManifestBoundary();

  testReleaseExceptionCorrectsUser38Action();
  testReleaseExceptionFailsClosedOnStaleManifestAction();
  testReleaseExceptionNoOpOutsideUsersPhase();
  testReleaseExceptionRegistryDoesNotCoverThePlaceCityFailure();
  await testPlaceCityPrerequisitesReportAllMissingBeforeWrite();
  await testPlaceCityPrerequisitesRejectAmbiguousMatch();
  await testInactiveCityDoesNotSatisfyPrerequisite();
  await testPlaceCityPrerequisitesAcceptExactlyOneEach();

  testExtractFailedKeyStripsMultiColonSuffix();
  testExtractFailedKeyRejectsNonFailure();
  testBuildContinuationEvidenceIncludesChainOrigin();
  testResolveChainOriginCodeShaFirstHopIsItsOwnOrigin();
  testResolveChainOriginCodeShaSecondHopInheritsOrigin();

  console.log("Phoenix continuation tests: OK");
}

void main();

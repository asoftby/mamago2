import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  KNOWN_PREDECESSOR_CODE_SHAS,
  PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT,
  PHOENIX_OFFERS_PARTIAL_REPORT_SHA256,
  PHOENIX_OFFERS_PARTIAL_TERMINAL_KEY,
  PHOENIX_RELEASE_ACTION_EXCEPTIONS,
  PHOENIX_SECOND_HOP_PREDECESSOR_REPORT_SHA256,
  applyReleaseActionExceptions,
  evaluateContinuationAwarePlan,
  assertPhoenixPlaceCityPrerequisites,
  buildContinuationEvidence,
  extractFailedKey,
  isPhoenixOffersPartialContinuation,
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

// =============================================================================
// Offers-partial hop (1ae265… → next image) — pinned failure report
// =============================================================================

const OFFERS_PARTIAL_CODE_SHA = "1ae2658108fda224acd994021752ff52452e8cad";
const OFFERS_PARTIAL_REPORT_SHA = "5490cc2503b8f028c08b6e99181429090ee4fe332343f293ae7f41b0702d78bb";
const OFFERS_PARTIAL_FAILED_KEY = "wordpress-db:hb-programs:43659";
const CURRENT_AFTER_OFFERS_PARTIAL = "c".repeat(40);

function offersPartialFailureReport(overrides: Partial<PhoenixPhaseReport> = {}): PhoenixPhaseReport {
  return baseReport({
    releaseId: "phoenix-approved-2026-07-30",
    codeSha: OFFERS_PARTIAL_CODE_SHA,
    phase: "offers",
    attempted: 53,
    created: 52,
    updated: 0,
    failed: 1,
    firstFailure: `${OFFERS_PARTIAL_FAILED_KEY}:PLACE_DEPENDENCY_MISSING_CITY`,
    completedPrefix: [],
    resolvedIdentities: {
      liveCheckpointSha256: "1eb43f7f635af6aa750b44ce17503a90c8952287b2ae92c6f998cf6e340f7508",
      liveCheckpointCodeSha: OFFERS_PARTIAL_CODE_SHA,
      liveCheckpointStartKey: "wordpress-db:hb-programs:18932",
    },
    ...overrides,
  });
}

function offersPartialApprovedManifest(): { manifest: PhoenixReleaseManifest; manifestHash: string } {
  const loaded = loadPhoenixReleaseManifest("docs/migration/releases/phoenix-approved-2026-07-30.json");
  return {
    manifest: { ...loaded.manifest, phases: loaded.manifest.phases.map(applyReleaseActionExceptions) },
    manifestHash: loaded.manifestHash,
  };
}

function offersPartialEnv(): PhoenixEnvironmentContext {
  return {
    environment: "DEV",
    database: {
      environment: "DEV",
      host: "db",
      port: "5432",
      database: "devmamago",
      schema: "public",
      currentDatabase: "devmamago",
    },
    storage: {
      environment: "DEV",
      provider: "none",
      locationHash: "4befce66a0662ee2898fac1823124092582b35948d02a9b094a27ac3281184aa",
    },
  };
}

function offersPartialRequest(report: PhoenixPhaseReport, overrides: Partial<{ reportSha256: string; predecessorCodeSha: string }> = {}) {
  // Use the exact authorized digest when the report bytes are the fixture
  // shape; otherwise hash the written content so negative tests that mutate
  // the report still exercise load-time SHA verification correctly.
  const raw = `${JSON.stringify(report)}\n`;
  const actual = sha256Bytes(raw);
  return {
    reportPath: tempReportPath(raw),
    reportSha256: overrides.reportSha256 ?? actual,
    predecessorCodeSha: overrides.predecessorCodeSha ?? OFFERS_PARTIAL_CODE_SHA,
  };
}

function testOffersPartialAllowlistContainsPredecessor(): void {
  assert(KNOWN_PREDECESSOR_CODE_SHAS.has(OFFERS_PARTIAL_CODE_SHA));
  assert.equal(PHOENIX_OFFERS_PARTIAL_REPORT_SHA256, OFFERS_PARTIAL_REPORT_SHA);
  assert.equal(PHOENIX_OFFERS_PARTIAL_TERMINAL_KEY, OFFERS_PARTIAL_FAILED_KEY);
  assert.equal(PHOENIX_OFFERS_PARTIAL_COMPLETED_COUNT, 52);
}

function testOffersPartialRejectsUnknownPredecessor(): void {
  const unknown = "d".repeat(40);
  const report = offersPartialFailureReport({ codeSha: unknown });
  assert.throws(
    () =>
      loadCrossShaContinuationChain(offersPartialRequest(report, { predecessorCodeSha: unknown }), {
        releaseId: "phoenix-approved-2026-07-30",
        manifestHash: "x",
        currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
        environment: offersPartialEnv(),
        manifest: offersPartialApprovedManifest().manifest,
      }),
    /CONTINUATION_PREDECESSOR_CODE_SHA_UNKNOWN/,
  );
}

function testOffersPartialRejectsWrongReportSha(): void {
  const { manifest, manifestHash } = offersPartialApprovedManifest();
  const report = offersPartialFailureReport({ manifestHash });
  assert.throws(
    () =>
      loadCrossShaContinuationChain(
        offersPartialRequest(report, { reportSha256: "0".repeat(64) }),
        {
          releaseId: "phoenix-approved-2026-07-30",
          manifestHash,
          currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
          environment: offersPartialEnv(),
          manifest,
        },
      ),
    /CONTINUATION_REPORT_SHA256_MISMATCH/,
  );
}

function testOffersPartialRejectsUnpinnedReportDigestEvenWithMatchingCodeSha(): void {
  const { manifest, manifestHash } = offersPartialApprovedManifest();
  const report = offersPartialFailureReport({ manifestHash, created: 52 });
  // Write real bytes then claim the authorized digest — pin must reject.
  const raw = `${JSON.stringify(report)}\n`;
  assert.notEqual(sha256Bytes(raw), OFFERS_PARTIAL_REPORT_SHA);
  assert.throws(
    () =>
      loadCrossShaContinuationChain(
        {
          reportPath: tempReportPath(raw),
          reportSha256: OFFERS_PARTIAL_REPORT_SHA,
          predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
        },
        {
          releaseId: "phoenix-approved-2026-07-30",
          manifestHash,
          currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
          environment: offersPartialEnv(),
          manifest,
        },
      ),
    /CONTINUATION_REPORT_SHA256_MISMATCH/,
  );
}

async function testOffersPartialRejectsMissingReportShaOnLiveResolve(): Promise<void> {
  const { manifest, manifestHash } = offersPartialApprovedManifest();
  const report = offersPartialFailureReport({ manifestHash, environmentFingerprint: offersPartialEnv() });
  const prisma = offersPartialPrisma(manifest);
  await assert.rejects(
    () =>
      evaluateContinuationAwarePlan({
        prisma,
        request: {
          reportPath: "unused",
          reportSha256: "0".repeat(64),
          predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
        },
        expected: {
          releaseId: "phoenix-approved-2026-07-30",
          manifestHash,
          currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
          environment: offersPartialEnv(),
          manifest,
        },
        chain: { priorPhaseReports: [], failureReport: report },
      }),
    /CONTINUATION_OFFERS_PARTIAL_REPORT_SHA_REQUIRED/,
  );
}

function testOffersPartialPinRejectsWrongCompletedCount(): void {
  const { manifest, manifestHash } = offersPartialApprovedManifest();
  for (const created of [51, 53]) {
    const report = offersPartialFailureReport({ manifestHash, created });
    assert.equal(
      isPhoenixOffersPartialContinuation({
        predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
        reportSha256: OFFERS_PARTIAL_REPORT_SHA,
        failureReport: report,
      }),
      false,
    );
    const raw = `${JSON.stringify(report)}\n`;
    // Mutated bytes cannot match the pinned digest: claim authorized → SHA
    // mismatch; claim actual → predecessor report not authorized.
    assert.throws(
      () =>
        loadCrossShaContinuationChain(
          {
            reportPath: tempReportPath(raw),
            reportSha256: OFFERS_PARTIAL_REPORT_SHA,
            predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
          },
          {
            releaseId: "phoenix-approved-2026-07-30",
            manifestHash,
            currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
            environment: offersPartialEnv(),
            manifest,
          },
        ),
      /CONTINUATION_REPORT_SHA256_MISMATCH/,
    );
    assert.throws(
      () =>
        loadCrossShaContinuationChain(
          {
            reportPath: tempReportPath(raw),
            reportSha256: sha256Bytes(raw),
            predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
          },
          {
            releaseId: "phoenix-approved-2026-07-30",
            manifestHash,
            currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
            environment: offersPartialEnv(),
            manifest,
          },
        ),
      /CONTINUATION_PREDECESSOR_REPORT_NOT_AUTHORIZED/,
    );
  }
}

function testOffersPartialPinRejectsWrongFailedKey(): void {
  const { manifest, manifestHash } = offersPartialApprovedManifest();
  const report = offersPartialFailureReport({
    manifestHash,
    firstFailure: "wordpress-db:hb-programs:18932:PLACE_DEPENDENCY_MISSING_CITY",
  });
  assert.equal(
    isPhoenixOffersPartialContinuation({
      predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
      reportSha256: OFFERS_PARTIAL_REPORT_SHA,
      failureReport: report,
    }),
    false,
  );
  const raw = `${JSON.stringify(report)}\n`;
  assert.throws(
    () =>
      loadCrossShaContinuationChain(
        {
          reportPath: tempReportPath(raw),
          reportSha256: OFFERS_PARTIAL_REPORT_SHA,
          predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
        },
        {
          releaseId: "phoenix-approved-2026-07-30",
          manifestHash,
          currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
          environment: offersPartialEnv(),
          manifest,
        },
      ),
    /CONTINUATION_REPORT_SHA256_MISMATCH/,
  );
  assert.throws(
    () =>
      loadCrossShaContinuationChain(
        { reportPath: tempReportPath(raw), reportSha256: sha256Bytes(raw), predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA },
        {
          releaseId: "phoenix-approved-2026-07-30",
          manifestHash,
          currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
          environment: offersPartialEnv(),
          manifest,
        },
      ),
    /CONTINUATION_PREDECESSOR_REPORT_NOT_AUTHORIZED/,
  );
}

function testOffersPartialPinRejectsMultipleFailures(): void {
  const { manifest, manifestHash } = offersPartialApprovedManifest();
  const report = offersPartialFailureReport({ manifestHash, failed: 2 });
  assert.equal(
    isPhoenixOffersPartialContinuation({
      predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
      reportSha256: OFFERS_PARTIAL_REPORT_SHA,
      failureReport: report,
    }),
    false,
  );
  const raw = `${JSON.stringify(report)}\n`;
  assert.throws(
    () =>
      loadCrossShaContinuationChain(
        {
          reportPath: tempReportPath(raw),
          reportSha256: OFFERS_PARTIAL_REPORT_SHA,
          predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
        },
        {
          releaseId: "phoenix-approved-2026-07-30",
          manifestHash,
          currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
          environment: offersPartialEnv(),
          manifest,
        },
      ),
    /CONTINUATION_REPORT_SHA256_MISMATCH/,
  );
}

function offersPartialLiveRows(manifest: PhoenixReleaseManifest) {
  const keys = (name: PhoenixPhaseName) => exactExecutableKeys(manifest.phases.find((phase) => phase.name === name)!);
  const offerPrefix = keys("offers").slice(0, 52);
  return {
    offerPrefix,
    lineages: [
      ...keys("users").map((sourceRecordKey) => ({ sourceRecordKey, targetType: "USER", targetId: `u-${sourceRecordKey}` })),
      ...keys("businesses").map((sourceRecordKey) => ({ sourceRecordKey, targetType: "BUSINESS", targetId: `b-${sourceRecordKey}` })),
      ...keys("places").map((sourceRecordKey) => ({
        sourceRecordKey,
        targetType: "PLACE",
        targetId: sourceRecordKey === "wordpress-db:places:43635" ? "place-43635" : `p-${sourceRecordKey}`,
      })),
      ...offerPrefix.map((sourceRecordKey) => ({ sourceRecordKey, targetType: "OFFER", targetId: `o-${sourceRecordKey}` })),
    ],
    offers: offerPrefix.map((createRequestId) => ({ createRequestId, id: `o-${createRequestId}` })),
  };
}

function offersPartialPrisma(manifest: PhoenixReleaseManifest, mutate?: (state: ReturnType<typeof offersPartialLiveRows>) => void) {
  const state = offersPartialLiveRows(manifest);
  mutate?.(state);
  const lineages = state.lineages.filter(
    (row, index, all) =>
      all.findIndex((other) => other.sourceRecordKey === row.sourceRecordKey && other.targetType === row.targetType) === index,
  );
  return {
    migrationLineage: {
      findMany: async (args: { where: { targetType?: string; sourceRecordKey?: string } }) => {
        let rows = lineages;
        if (args.where.targetType) rows = rows.filter((row) => row.targetType === args.where.targetType);
        if (args.where.sourceRecordKey) rows = rows.filter((row) => row.sourceRecordKey === args.where.sourceRecordKey);
        return rows.map(({ sourceRecordKey, targetId }) => ({ sourceRecordKey, targetId }));
      },
    },
    offer: {
      findMany: async (args: { where: { createRequestId: { in: string[] } } }) =>
        state.offers.filter((offer) => args.where.createRequestId.in.includes(offer.createRequestId)),
      findUnique: async (args: { where: { createRequestId: string } }) =>
        state.offers.find((offer) => offer.createRequestId === args.where.createRequestId) ?? null,
    },
    place: {
      findUnique: async (args: { where: { id: string } }) =>
        args.where.id === "place-43635"
          ? { id: "place-43635", cityId: "city-ratomka", city: { slug: "ratomka", name: "Ратомка", isActive: true } }
          : null,
    },
    city: {
      findMany: async () => [
        { id: "city-kopishche", name: "Копище" },
        { id: "city-mir", name: "Мир" },
        { id: "city-ratomka", name: "Ратомка" },
      ],
    },
  } as unknown as import("@prisma/client").PrismaClient;
}

async function testOffersPartialExactApprovedReportReady(): Promise<void> {
  const { manifest, manifestHash } = offersPartialApprovedManifest();
  // Reconstruct the exact authorized report bytes by using the real DEV
  // fingerprint fields + manifestHash, then force the digest gate via the
  // isPhoenixOffersPartialContinuation path through evaluateContinuationAwarePlan
  // with a locally-consistent hash (pin check already covered above).
  const report = offersPartialFailureReport({
    manifestHash,
    environmentFingerprint: offersPartialEnv(),
  });
  const request = offersPartialRequest(report);
  // For evaluate we bypass loadCrossShaContinuationChain's pin-vs-real-file
  // digest equality by supplying a chain directly, and pass the authorized
  // report SHA so isPhoenixOffersPartialContinuation matches.
  const chain = { priorPhaseReports: [] as const, failureReport: report };
  const prisma = offersPartialPrisma(manifest);
  const result = await evaluateContinuationAwarePlan({
    prisma,
    request: { ...request, reportSha256: OFFERS_PARTIAL_REPORT_SHA },
    expected: {
      releaseId: "phoenix-approved-2026-07-30",
      manifestHash,
      currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
      environment: offersPartialEnv(),
      manifest,
    },
    chain,
  });
  assert.equal(result.status, "READY");
  assert.equal(result.continuationStartKey, OFFERS_PARTIAL_FAILED_KEY);
  assert.equal(result.completed.offers?.length, 52);
  assert.equal(result.completed.users?.length, exactExecutableKeys(manifest.phases.find((p) => p.name === "users")!).length);
  assert.equal(result.completed.businesses?.length, exactExecutableKeys(manifest.phases.find((p) => p.name === "businesses")!).length);
  assert.equal(result.completed.places?.length, exactExecutableKeys(manifest.phases.find((p) => p.name === "places")!).length);
  assert.equal(result.writesAttempted, 0);
  assert.equal(result.laterPhasesUntouched, true);
}

async function testOffersPartialRejectsMissingLineageAmong52(): Promise<void> {
  const { manifest, manifestHash } = offersPartialApprovedManifest();
  const report = offersPartialFailureReport({ manifestHash, environmentFingerprint: offersPartialEnv() });
  const prisma = offersPartialPrisma(manifest, (state) => {
    state.lineages = state.lineages.filter((row) => !(row.targetType === "OFFER" && row.sourceRecordKey === state.offerPrefix[0]));
    state.offers = state.offers.filter((offer) => offer.createRequestId !== state.offerPrefix[0]);
  });
  await assert.rejects(
    () =>
      evaluateContinuationAwarePlan({
        prisma,
        request: {
          reportPath: "unused",
          reportSha256: OFFERS_PARTIAL_REPORT_SHA,
          predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
        },
        expected: {
          releaseId: "phoenix-approved-2026-07-30",
          manifestHash,
          currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
          environment: offersPartialEnv(),
          manifest,
        },
        chain: { priorPhaseReports: [], failureReport: report },
      }),
    /CONTINUATION_PREFIX_KEY_MISSING/,
  );
}

async function testOffersPartialRejectsWhenFailedOfferAlreadyExists(): Promise<void> {
  const { manifest, manifestHash } = offersPartialApprovedManifest();
  const report = offersPartialFailureReport({ manifestHash, environmentFingerprint: offersPartialEnv() });
  const prisma = offersPartialPrisma(manifest, (state) => {
    state.lineages.push({ sourceRecordKey: OFFERS_PARTIAL_FAILED_KEY, targetType: "OFFER", targetId: "offer-43659" });
    state.offers.push({ createRequestId: OFFERS_PARTIAL_FAILED_KEY, id: "offer-43659" });
  });
  await assert.rejects(
    () =>
      evaluateContinuationAwarePlan({
        prisma,
        request: {
          reportPath: "unused",
          reportSha256: OFFERS_PARTIAL_REPORT_SHA,
          predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
        },
        expected: {
          releaseId: "phoenix-approved-2026-07-30",
          manifestHash,
          currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
          environment: offersPartialEnv(),
          manifest,
        },
        chain: { priorPhaseReports: [], failureReport: report },
      }),
    /CONTINUATION_FAILED_KEY_ALREADY_COMPLETE|CONTINUATION_OFFERS_PARTIAL_FAILED_KEY_TARGET_EXISTS|CONTINUATION_UNEXPECTED_COMPLETED_KEY/,
  );
}

async function testOffersPartialRejectsLaterPhaseStarted(): Promise<void> {
  const { manifest, manifestHash } = offersPartialApprovedManifest();
  const report = offersPartialFailureReport({ manifestHash, environmentFingerprint: offersPartialEnv() });
  const prisma = offersPartialPrisma(manifest, (state) => {
    state.lineages.push({ sourceRecordKey: "wordpress-db:routes:1", targetType: "ROUTE", targetId: "route-1" });
  });
  await assert.rejects(
    () =>
      evaluateContinuationAwarePlan({
        prisma,
        request: {
          reportPath: "unused",
          reportSha256: OFFERS_PARTIAL_REPORT_SHA,
          predecessorCodeSha: OFFERS_PARTIAL_CODE_SHA,
        },
        expected: {
          releaseId: "phoenix-approved-2026-07-30",
          manifestHash,
          currentCodeSha: CURRENT_AFTER_OFFERS_PARTIAL,
          environment: offersPartialEnv(),
          manifest,
        },
        chain: { priorPhaseReports: [], failureReport: report },
      }),
    /CONTINUATION_LATER_PHASE_TOUCHED:routes/,
  );
}

async function testOffersPartialCompletedWritersAreNotInvoked(): Promise<void> {
  const { SequentialEntityPhaseAdapter } = await import("./adapter");
  const { manifest } = offersPartialApprovedManifest();
  const offersPhase = manifest.phases.find((phase) => phase.name === "offers")!;
  const prefix = new Set(exactExecutableKeys(offersPhase).slice(0, 52));
  let executeCalls = 0;
  const adapter = new SequentialEntityPhaseAdapter(
    {
      execute: async (sourceRecordKey) => {
        executeCalls += 1;
        return { sourceRecordKey, action: "CREATE", outcome: "CREATED" };
      },
    },
    prefix,
  );
  const results = await adapter.apply(offersPhase);
  const skipped = results.filter((result) => result.outcome === "SKIPPED");
  assert.equal(skipped.length, 52);
  assert.equal(results[52]?.sourceRecordKey, OFFERS_PARTIAL_FAILED_KEY);
  assert.equal(executeCalls, exactExecutableKeys(offersPhase).length - 52);
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

  testOffersPartialAllowlistContainsPredecessor();
  testOffersPartialRejectsUnknownPredecessor();
  testOffersPartialRejectsWrongReportSha();
  testOffersPartialRejectsUnpinnedReportDigestEvenWithMatchingCodeSha();
  await testOffersPartialRejectsMissingReportShaOnLiveResolve();
  testOffersPartialPinRejectsWrongCompletedCount();
  testOffersPartialPinRejectsWrongFailedKey();
  testOffersPartialPinRejectsMultipleFailures();
  await testOffersPartialExactApprovedReportReady();
  await testOffersPartialRejectsMissingLineageAmong52();
  await testOffersPartialRejectsWhenFailedOfferAlreadyExists();
  await testOffersPartialRejectsLaterPhaseStarted();
  await testOffersPartialCompletedWritersAreNotInvoked();

  console.log("Phoenix continuation tests: OK");
}

void main();

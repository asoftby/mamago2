import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SequentialEntityPhaseAdapter } from "../adapter";
import { runPhoenixRelease } from "../coordinator";
import { loadPhoenixEnvironment } from "../environment";
import { loadPhoenixReleaseManifest, parsePhoenixReleaseManifest, verifyArtifactHashes } from "../manifest";
import type { PhoenixEnvironmentContext, PhoenixPhaseReport, PhoenixReleaseManifest, PhoenixReleasePhase } from "../types";
import { UsersPhaseExecutor, type UsersMigrationDependencies } from "./usersAdapter";
import { BusinessOwnershipPhaseExecutor, type BusinessOwnershipDependencies, type BusinessOwnershipOverride } from "./businessOwnershipAdapter";
import { USERS_UNRESOLVED_SOURCE_RECORD_KEYS, assertExactExclusionSet } from "../knownBlockers";

const environment: PhoenixEnvironmentContext = {
  environment: "LOCAL",
  database: { environment: "LOCAL", host: "localhost", port: "5433", database: "mamago2", schema: "public", currentDatabase: "mamago2" },
  storage: { environment: "LOCAL", provider: "filesystem", locationHash: "fixture-hash" },
};

async function expectReject(action: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  await assert.rejects(action, pattern);
}

// ---------------------------------------------------------------------------
// Committed artifact shape checks (real files, no fakes)
// ---------------------------------------------------------------------------

function testOwnershipArtifactsExactScope(): void {
  const base = JSON.parse(readFileSync("docs/migration/manifests/phoenix-business-ownership-base-2026-07-30.json", "utf8"));
  assert.equal(base.recordCount, 36);
  assert.equal(base.entries.length, 36);
  assert.equal(new Set(base.entries.map((e: { sourceRecordKey: string }) => e.sourceRecordKey)).size, 36, "no duplicate base entries");

  const overrides = JSON.parse(readFileSync("docs/migration/manifests/phoenix-business-ownership-overrides-2026-07-30.json", "utf8")) as {
    recordCount: number;
    entries: Array<{ sourceRecordKey: string; approvedPlaceSourcePostIds: string[] }>;
  };
  assert.equal(overrides.recordCount, 2);
  const byKey = new Map(overrides.entries.map((e) => [e.sourceRecordKey, e]));
  assert.equal(byKey.get("wordpress-db:user:89")?.approvedPlaceSourcePostIds.length, 19);
  assert.equal(byKey.get("wordpress-db:user:130")?.approvedPlaceSourcePostIds.length, 1);

  const baseKeys = new Set(base.entries.map((e: { sourceRecordKey: string }) => e.sourceRecordKey));
  assert(!baseKeys.has("wordpress-db:user:89"), "override users must not appear in the generic base rule");
  assert(!baseKeys.has("wordpress-db:user:130"), "override users must not appear in the generic base rule");
}

// ---------------------------------------------------------------------------
// Founder-approved first-release exclusion set (fail-closed)
// ---------------------------------------------------------------------------

function testAssertExactExclusionSetAcceptsTheRealFive(): void {
  assertExactExclusionSet(
    [...USERS_UNRESOLVED_SOURCE_RECORD_KEYS],
    USERS_UNRESOLVED_SOURCE_RECORD_KEYS,
  ); // must not throw
}

function testAssertExactExclusionSetRejectsMissingKey(): void {
  const missingOne = USERS_UNRESOLVED_SOURCE_RECORD_KEYS.slice(0, 4);
  assert.throws(
    () => assertExactExclusionSet(missingOne, USERS_UNRESOLVED_SOURCE_RECORD_KEYS),
    /EXCLUSION_COUNT_MISMATCH/,
  );
}

function testAssertExactExclusionSetRejectsExtraKey(): void {
  const extra = [...USERS_UNRESOLVED_SOURCE_RECORD_KEYS, "wordpress-db:user:999"];
  assert.throws(
    () => assertExactExclusionSet(extra, USERS_UNRESOLVED_SOURCE_RECORD_KEYS),
    /EXCLUSION_COUNT_MISMATCH/,
  );
}

function testAssertExactExclusionSetRejectsSubstitutedKey(): void {
  const substituted = [...USERS_UNRESOLVED_SOURCE_RECORD_KEYS.slice(0, 4), "wordpress-db:user:999"];
  assert.throws(
    () => assertExactExclusionSet(substituted, USERS_UNRESOLVED_SOURCE_RECORD_KEYS),
    /UNKNOWN_EXCLUSION_KEY/,
  );
}

function testAssertExactExclusionSetRejectsDuplicate(): void {
  const withDuplicate = [...USERS_UNRESOLVED_SOURCE_RECORD_KEYS, USERS_UNRESOLVED_SOURCE_RECORD_KEYS[0]];
  assert.throws(
    () => assertExactExclusionSet(withDuplicate, USERS_UNRESOLVED_SOURCE_RECORD_KEYS),
    /DUPLICATE_EXCLUSION/,
  );
}

function testFounderExclusionArtifactRealFileNoPii(): void {
  const raw = readFileSync("docs/migration/manifests/phoenix-users-founder-exclusions-2026-07-31.json", "utf8");
  const artifact = JSON.parse(raw) as {
    decisionType: string;
    approvedBy: string;
    excludedCount: number;
    excludedSourceRecordKeys: string[];
  };
  assert.equal(artifact.decisionType, "EXCLUDE_FROM_FIRST_RELEASE");
  assert.equal(artifact.approvedBy, "FOUNDER");
  assert.equal(artifact.excludedCount, 5);
  assertExactExclusionSet(artifact.excludedSourceRecordKeys, USERS_UNRESOLVED_SOURCE_RECORD_KEYS);
  assert(!/@/.test(raw), "founder exclusion artifact must contain no email addresses");
  for (const field of ["email", "firstName", "lastName", "displayName"]) {
    assert(!raw.toLowerCase().includes(field.toLowerCase()), `founder exclusion artifact must not reference ${field}`);
  }
}

function testRealManifestUsersReadyWithExclusions(): void {
  const manifestPath = "docs/migration/releases/phoenix-approved-2026-07-30.json";
  const { manifest } = loadPhoenixReleaseManifest(manifestPath);
  const users = manifest.phases.find((p) => p.name === "users")!;
  assert.equal(users.status, "READY");
  assert.equal(users.blocker, undefined, "READY phase must carry no leftover blocker");
  assert.equal(users.records.length, 559);
  assert.equal(users.excludedSourceRecordKeys.length, 5);
  assertExactExclusionSet(users.excludedSourceRecordKeys, USERS_UNRESOLVED_SOURCE_RECORD_KEYS);
  for (const key of USERS_UNRESOLVED_SOURCE_RECORD_KEYS) {
    assert.equal(users.exclusionReasons?.[key], "EXCLUDE_FROM_FIRST_RELEASE");
    assert(!users.records.some((r) => r.sourceRecordKey === key), `${key} must not be executable`);
  }
}

function testRealManifestBusinessesReadyWithExclusionReason(): void {
  const manifestPath = "docs/migration/releases/phoenix-approved-2026-07-30.json";
  const { manifest } = loadPhoenixReleaseManifest(manifestPath);
  const businesses = manifest.phases.find((p) => p.name === "businesses")!;
  assert.equal(businesses.status, "READY");
  assert.equal(businesses.blocker, undefined, "READY phase must carry no leftover blocker");
  assert.equal(businesses.records.length, 37);
  assert.equal(businesses.exclusionReasons?.["wordpress-db:user:43"], "EXCLUDED_BY_USER_DECISION");
}

async function testSequentialApplyOverRealScopeNeverAttemptsExcludedRecords(): Promise<void> {
  const manifestPath = "docs/migration/releases/phoenix-approved-2026-07-30.json";
  const { manifest, manifestHash } = loadPhoenixReleaseManifest(manifestPath);
  const users = manifest.phases.find((p) => p.name === "users")!;
  const businesses = manifest.phases.find((p) => p.name === "businesses")!;
  const subManifest: PhoenixReleaseManifest = {
    schemaVersion: 1,
    releaseId: manifest.releaseId,
    phaseOrder: ["users", "businesses"],
    phases: [users, businesses],
  };
  const attempted: string[] = [];
  const fakeAdapter = new SequentialEntityPhaseAdapter({
    execute: async (sourceRecordKey, action) => {
      attempted.push(sourceRecordKey);
      return { sourceRecordKey, action, outcome: "CREATED" };
    },
  });
  const reports: PhoenixPhaseReport[] = [];
  const result = await runPhoenixRelease({
    manifest: subManifest,
    manifestPath,
    manifestHash,
    environment,
    codeSha: "fixture-sha",
    adapters: { users: fakeAdapter, businesses: fakeAdapter },
    reportStore: { append: async (report) => void reports.push(report) },
    mode: "APPLY",
  });
  assert.equal(result.length, 2, "both users and businesses phases must complete");
  assert.equal(attempted.length, 559 + 37, "exactly the executable scope, no more, no less");
  for (const key of USERS_UNRESOLVED_SOURCE_RECORD_KEYS) {
    assert(!attempted.includes(key), `excluded ${key} must never be passed to an executor`);
  }
  assert(!attempted.includes("wordpress-db:user:43"), "user:43 must never be attempted in the businesses phase");
}

// ---------------------------------------------------------------------------
// UsersPhaseExecutor
// ---------------------------------------------------------------------------

async function testUsersExecutorForbidsAdminMutation(): Promise<void> {
  const deps: UsersMigrationDependencies = {
    loadCandidate: (sourceRecordKey) => ({ sourceRecordKey }),
    plan: async () => ({ action: "CREATE", reason: null, draftRole: "ADMIN" }),
    write: async () => {
      throw new Error("write must never be called when role elevation is attempted");
    },
  };
  const executor = new UsersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:user:1", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "ADMIN_MUTATION_FORBIDDEN");
}

async function testUsersExecutorRejectsUnexpectedPlanAction(): Promise<void> {
  const deps: UsersMigrationDependencies = {
    loadCandidate: (sourceRecordKey) => ({ sourceRecordKey }),
    plan: async () => ({ action: "SKIP_UNCHANGED", reason: null, draftRole: "USER" }),
    write: async () => ({ action: "CREATE", targetId: "u1" }),
  };
  const executor = new UsersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:user:2", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "UNEXPECTED_PLAN_ACTION:SKIP_UNCHANGED");
}

async function testUsersExecutorIdempotentSkip(): Promise<void> {
  let writeCalls = 0;
  const deps: UsersMigrationDependencies = {
    loadCandidate: (sourceRecordKey) => ({ sourceRecordKey }),
    plan: async () => ({ action: "SKIP_UNCHANGED", reason: null, draftRole: "USER" }),
    write: async () => {
      writeCalls += 1;
      return { action: "CREATE", targetId: "u1" };
    },
  };
  const executor = new UsersPhaseExecutor(deps);
  const result = await executor.execute("wordpress-db:user:3", "SKIP_UNCHANGED");
  assert.equal(result.outcome, "SKIPPED");
  assert.equal(writeCalls, 0, "SKIP_UNCHANGED must never invoke write");
}

// ---------------------------------------------------------------------------
// BusinessOwnershipPhaseExecutor
// ---------------------------------------------------------------------------

const OVERRIDES: readonly BusinessOwnershipOverride[] = [
  { sourceRecordKey: "wordpress-db:user:130", approvedPlaceSourcePostIds: ["18886"] },
  {
    sourceRecordKey: "wordpress-db:user:89",
    approvedPlaceSourcePostIds: ["437", "5457", "5492", "5515", "5528", "5579", "12447", "12923", "13311", "13317", "13322", "13323", "13324", "13327", "13331", "45846", "48372", "49952", "49977"],
  },
];

function fakeBusinessDeps(overrides: Partial<BusinessOwnershipDependencies> = {}): BusinessOwnershipDependencies {
  return {
    resolveUserDependency: async () => ({ matchCount: 1, userId: "user-1" }),
    resolveGenericOwnedPlaceSourcePostIds: async () => ["place-1"],
    linkOwnership: async (_userId, placeIds) => ({ action: "CREATE", businessId: "biz-1", linkedPlaceCount: placeIds.length }),
    elevateToBusinessOwner: async () => ({ action: "CREATE" }),
    ...overrides,
  };
}

async function testBusinessOwnershipUsesOverrideNotGenericRule(): Promise<void> {
  let genericCalled = false;
  let linkedIds: readonly string[] = [];
  const deps = fakeBusinessDeps({
    resolveGenericOwnedPlaceSourcePostIds: async () => {
      genericCalled = true;
      return ["should-not-be-used"];
    },
    linkOwnership: async (_userId, placeIds) => {
      linkedIds = placeIds;
      return { action: "CREATE", businessId: "biz-89", linkedPlaceCount: placeIds.length };
    },
  });
  const executor = new BusinessOwnershipPhaseExecutor(deps, OVERRIDES);
  const result = await executor.execute("wordpress-db:user:89", "CREATE");
  assert.equal(result.outcome, "CREATED");
  assert.equal(genericCalled, false, "override users must never fall through to the generic ownership resolver");
  assert.equal(linkedIds.length, 19);
}

async function testBusinessOwnershipZeroUserMatchesFailsClosed(): Promise<void> {
  const deps = fakeBusinessDeps({ resolveUserDependency: async () => ({ matchCount: 0, userId: null }) });
  const executor = new BusinessOwnershipPhaseExecutor(deps, OVERRIDES);
  const result = await executor.execute("wordpress-db:user:140", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "USER_DEPENDENCY_NOT_FOUND");
}

async function testBusinessOwnershipAmbiguousUserMatchesFailsClosed(): Promise<void> {
  const deps = fakeBusinessDeps({ resolveUserDependency: async () => ({ matchCount: 2, userId: null }) });
  const executor = new BusinessOwnershipPhaseExecutor(deps, OVERRIDES);
  const result = await executor.execute("wordpress-db:user:140", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "USER_DEPENDENCY_AMBIGUOUS");
}

async function testBusinessOwnershipPlaceCountMismatchFailsClosed(): Promise<void> {
  const deps = fakeBusinessDeps({
    // Simulates an underlying writer that silently linked fewer Places
    // than the exact approved override list (e.g. a concurrently-claimed
    // Place) — must fail, never partially succeed.
    linkOwnership: async (_userId, placeIds) => ({ action: "CREATE", businessId: "biz-130", linkedPlaceCount: placeIds.length - 1 }),
  });
  const executor = new BusinessOwnershipPhaseExecutor(deps, OVERRIDES);
  const result = await executor.execute("wordpress-db:user:130", "CREATE");
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "OWNERSHIP_PLACE_COUNT_MISMATCH");
}

function testBusinessOwnershipRejectsDuplicateOverrideIds(): void {
  assert.throws(
    () => new BusinessOwnershipPhaseExecutor(fakeBusinessDeps(), [{ sourceRecordKey: "wordpress-db:user:1", approvedPlaceSourcePostIds: ["1", "1"] }]),
    /DUPLICATE_OVERRIDE_PLACE_ID/,
  );
}

async function testBusinessOwnershipRerunIdempotent(): Promise<void> {
  const deps = fakeBusinessDeps({
    linkOwnership: async (_userId, placeIds) => ({ action: "SKIP_UNCHANGED", businessId: "biz-1", linkedPlaceCount: placeIds.length }),
    elevateToBusinessOwner: async () => ({ action: "SKIP_UNCHANGED" }),
  });
  const executor = new BusinessOwnershipPhaseExecutor(deps, OVERRIDES);
  const result = await executor.execute("wordpress-db:user:140", "SKIP_UNCHANGED");
  assert.equal(result.outcome, "SKIPPED");
}

// ---------------------------------------------------------------------------
// Release-level: Users BLOCKED must halt before Businesses ever runs
// ---------------------------------------------------------------------------

function phaseFixture(name: PhoenixReleasePhase["name"], status: PhoenixReleasePhase["status"], blocker?: string): PhoenixReleasePhase {
  return {
    name,
    status,
    artifacts: [],
    records: status === "BLOCKED" ? [] : [{ sourceRecordKey: `${name}:1`, action: "CREATE" }],
    protectedSourceRecordKeys: [],
    excludedSourceRecordKeys: [],
    deterministicConflicts: [],
    mediaPolicy: "NONE",
    prerequisites: [],
    ...(blocker ? { blocker, blockerCode: "USERS_HISTORICAL_NAME_INPUT_UNRECOVERABLE" } : {}),
  };
}

async function testUsersBlockedPreventsBusinessesFromRunning(): Promise<void> {
  const manifest: PhoenixReleaseManifest = {
    schemaVersion: 1,
    releaseId: "test-users-businesses",
    phaseOrder: ["users", "businesses"],
    phases: [
      phaseFixture("users", "BLOCKED", "559/564 reconstructed; 5 sourceRecordKeys unresolved."),
      phaseFixture("businesses", "READY"),
    ],
  };
  let businessesAdapterCalled = false;
  const reports: PhoenixPhaseReport[] = [];
  await expectReject(
    () =>
      runPhoenixRelease({
        manifest,
        manifestPath: "fixture.json",
        manifestHash: "fixture-hash",
        environment,
        codeSha: "fixture-sha",
        adapters: {
          businesses: new SequentialEntityPhaseAdapter({
            execute: async (sourceRecordKey, action) => {
              businessesAdapterCalled = true;
              return { sourceRecordKey, action, outcome: "CREATED" };
            },
          }),
        },
        reportStore: { append: async (report) => void reports.push(report) },
        mode: "APPLY",
      }),
    /PHASE_BLOCKED: users/,
  );
  assert.equal(businessesAdapterCalled, false, "Businesses adapter must never be invoked while Users is BLOCKED");
  assert.equal(reports.length, 0, "no report may be appended for a phase that never ran");
}

async function testResumeCannotSkipBlockedUsersPhase(): Promise<void> {
  const manifest: PhoenixReleaseManifest = {
    schemaVersion: 1,
    releaseId: "test-resume",
    phaseOrder: ["users", "businesses"],
    phases: [phaseFixture("users", "BLOCKED", "unresolved"), phaseFixture("businesses", "READY")],
  };
  await expectReject(
    () =>
      runPhoenixRelease({
        manifest,
        manifestPath: "fixture.json",
        manifestHash: "fixture-hash",
        environment,
        codeSha: "fixture-sha",
        adapters: { businesses: new SequentialEntityPhaseAdapter({ execute: async (k, a) => ({ sourceRecordKey: k, action: a, outcome: "CREATED" }) }) },
        reportStore: { append: async () => {} },
        mode: "APPLY",
        resumeFrom: "businesses",
        previousReports: [],
      }),
    /RESUME_REPORT_REQUIRED/,
  );
}

function testBusinessesPhaseExcludesUserEntangledWithUnresolvedUsers(): void {
  const manifestPath = "docs/migration/releases/phoenix-approved-2026-07-30.json";
  const { manifest } = loadPhoenixReleaseManifest(manifestPath);
  const businesses = manifest.phases.find((p) => p.name === "businesses")!;
  // wordpress-db:user:43 is one of the 36 EXACT_LINK_CANDIDATE users AND
  // one of the 5 permanently-unresolved Users records — a sequential
  // apply must never attempt it (its User dependency can never resolve),
  // so it must be excluded from executable records, not merely present
  // and expected to fail.
  assert(!businesses.records.some((r) => r.sourceRecordKey === "wordpress-db:user:43"));
  assert(businesses.excludedSourceRecordKeys.includes("wordpress-db:user:43"));
  assert.equal(businesses.records.length, 37, "36 generic - 1 entangled + 2 override = 37");
}

function testManifestRejectsStaleBlockerOnReadyPhase(): void {
  const base: PhoenixReleaseManifest = {
    schemaVersion: 1,
    releaseId: "test-stale-blocker",
    phaseOrder: ["places"],
    phases: [
      {
        name: "places",
        status: "READY",
        artifacts: [],
        records: [],
        protectedSourceRecordKeys: [],
        excludedSourceRecordKeys: [],
        deterministicConflicts: [],
        mediaPolicy: "NONE",
        prerequisites: [],
        blocker: "stale leftover text",
      },
    ],
  };
  assert.throws(() => parsePhoenixReleaseManifest(JSON.stringify(base), "fixture"), /stale blocker/);
}

function testCommittedManifestArtifactHashesVerify(): void {
  const manifestPath = "docs/migration/releases/phoenix-approved-2026-07-30.json";
  const { manifest } = loadPhoenixReleaseManifest(manifestPath);
  verifyArtifactHashes(manifestPath, manifest); // must not throw
  const businesses = manifest.phases.find((p) => p.name === "businesses")!;
  const tampered = { ...businesses, artifacts: [{ ...businesses.artifacts[0], sha256: "0".repeat(64) }] };
  assert.throws(
    () => verifyArtifactHashes(manifestPath, { ...manifest, phases: [tampered] }),
    /ARTIFACT_HASH_MISMATCH/,
  );
}

function testBlockerRecordsContainNoPii(): void {
  const manifestPath = "docs/migration/releases/phoenix-approved-2026-07-30.json";
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PhoenixReleaseManifest;
  const users = manifest.phases.find((p) => p.name === "users")!;
  const blob = JSON.stringify(users);
  assert(!/@/.test(blob), "no email addresses may appear in the users phase blocker/manifest");
  assert(!/[a-z]+\.[a-z]+@/i.test(blob), "no email-shaped strings");
}

// ---------------------------------------------------------------------------
// Activation delivery must stay disabled regardless of phase
// ---------------------------------------------------------------------------

async function testActivationEmailGateBlocksPhoenixEnvironment(): Promise<void> {
  await expectReject(
    () =>
      loadPhoenixEnvironment({
        environment: "LOCAL",
        confirmProduction: false,
        env: {
          NODE_ENV: "development",
          APP_ENV: "LOCAL",
          PHOENIX_DATABASE_ENV: "LOCAL",
          PHOENIX_STORAGE_ENV: "LOCAL",
          PHOENIX_STORAGE_PROVIDER: "filesystem",
          PHOENIX_STORAGE_LOCATION: "/safe/local",
          DATABASE_URL: "postgresql://user:pass@localhost:5433/mamago2?schema=public",
          MIGRATED_USER_ACTIVATION_EMAIL_ENABLED: "true",
        },
      }),
    /EMAIL_GATE_OPEN/,
  );
}

async function main(): Promise<void> {
  testOwnershipArtifactsExactScope();
  testAssertExactExclusionSetAcceptsTheRealFive();
  testAssertExactExclusionSetRejectsMissingKey();
  testAssertExactExclusionSetRejectsExtraKey();
  testAssertExactExclusionSetRejectsSubstitutedKey();
  testAssertExactExclusionSetRejectsDuplicate();
  testFounderExclusionArtifactRealFileNoPii();
  testRealManifestUsersReadyWithExclusions();
  testRealManifestBusinessesReadyWithExclusionReason();
  await testSequentialApplyOverRealScopeNeverAttemptsExcludedRecords();
  testBusinessesPhaseExcludesUserEntangledWithUnresolvedUsers();
  testManifestRejectsStaleBlockerOnReadyPhase();
  testCommittedManifestArtifactHashesVerify();
  await testUsersExecutorForbidsAdminMutation();
  await testUsersExecutorRejectsUnexpectedPlanAction();
  await testUsersExecutorIdempotentSkip();
  await testBusinessOwnershipUsesOverrideNotGenericRule();
  await testBusinessOwnershipZeroUserMatchesFailsClosed();
  await testBusinessOwnershipAmbiguousUserMatchesFailsClosed();
  await testBusinessOwnershipPlaceCountMismatchFailsClosed();
  testBusinessOwnershipRejectsDuplicateOverrideIds();
  await testBusinessOwnershipRerunIdempotent();
  await testUsersBlockedPreventsBusinessesFromRunning();
  await testResumeCannotSkipBlockedUsersPhase();
  testBlockerRecordsContainNoPii();
  await testActivationEmailGateBlocksPhoenixEnvironment();
  console.log("Phoenix Users/Businesses adapter tests: PASS");
}

void main();

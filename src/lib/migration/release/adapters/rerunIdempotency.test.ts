import assert from "node:assert/strict";

import { SequentialEntityPhaseAdapter } from "../adapter";
import type { PhoenixReleasePhase } from "../types";
import { ArticlesPhaseExecutor } from "./articlesAdapter";
import { EventsPhaseExecutor } from "./eventsAdapter";
import { OffersPhaseExecutor, type OffersMigrationCandidate } from "./offersAdapter";
import { PlacesPhaseExecutor } from "./placesAdapter";
import { isRerunForbiddenLiveCreate, isRerunIdempotentCreateSkip } from "./rerunIdempotency";
import { RoutesPhaseExecutor } from "./routesAdapter";
import { UsersPhaseExecutor, type UsersMigrationDependencies } from "./usersAdapter";

const HASH = "domain-hash-v1";

function phaseFixture(name: PhoenixReleasePhase["name"], keys: string[]): PhoenixReleasePhase {
  return {
    name,
    status: "READY",
    artifacts: [],
    records: keys.map((sourceRecordKey) => ({ sourceRecordKey, action: "CREATE" as const })),
    protectedSourceRecordKeys: [],
    excludedSourceRecordKeys: [],
    deterministicConflicts: [],
    mediaPolicy: "NONE",
    prerequisites: [],
  };
}

function unchangedLineageTarget(hash = HASH) {
  return { lineageCount: 1, targetExists: true, lineageDomainHash: hash, duplicateLineageTarget: false };
}

function testHelperGates(): void {
  assert.equal(isRerunIdempotentCreateSkip("CREATE", "SKIP_UNCHANGED", { mode: "RERUN" }), true);
  assert.equal(isRerunIdempotentCreateSkip("CREATE", "SKIP_UNCHANGED", { mode: "APPLY" }), false);
  assert.equal(isRerunIdempotentCreateSkip("CREATE", "SKIP_UNCHANGED", undefined), false);
  assert.equal(isRerunIdempotentCreateSkip("CREATE", "CREATE", { mode: "RERUN" }), false);
  assert.equal(isRerunIdempotentCreateSkip("CREATE", "CONFLICT", { mode: "RERUN" }), false);
  assert.equal(isRerunForbiddenLiveCreate("CREATE", { mode: "RERUN" }), true);
  assert.equal(isRerunForbiddenLiveCreate("CREATE", { mode: "APPLY" }), false);
  assert.equal(isRerunForbiddenLiveCreate("SKIP_UNCHANGED", { mode: "RERUN" }), false);
}

async function testUsersRerunAcceptsCreateAsSkipAndApplyStillRejects(): Promise<void> {
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
  const apply = await executor.execute("wordpress-db:user:1", "CREATE", { mode: "APPLY" });
  assert.equal(apply.outcome, "FAILED");
  assert.equal(apply.error, "UNEXPECTED_PLAN_ACTION:SKIP_UNCHANGED");

  const rerun = await executor.execute("wordpress-db:user:1", "CREATE", { mode: "RERUN" });
  assert.equal(rerun.outcome, "SKIPPED");
  assert.equal(writeCalls, 0);
}

async function testUsersRerunBlocksLiveCreate(): Promise<void> {
  let writeCalls = 0;
  const deps: UsersMigrationDependencies = {
    loadCandidate: (sourceRecordKey) => ({ sourceRecordKey }),
    plan: async () => ({ action: "CREATE", reason: null, draftRole: "USER" }),
    write: async () => {
      writeCalls += 1;
      return { action: "CREATE", targetId: "u1" };
    },
  };
  const result = await new UsersPhaseExecutor(deps).execute("wordpress-db:user:1", "CREATE", { mode: "RERUN" });
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "RERUN_LIVE_CREATE_FORBIDDEN");
  assert.equal(writeCalls, 0);
}

async function testUsersRerunBlocksUnexpectedUpdateLikeAction(): Promise<void> {
  // Plans have no UPDATE member; CONFLICT/hash-drift is the update-like path.
  const deps: UsersMigrationDependencies = {
    loadCandidate: (sourceRecordKey) => ({ sourceRecordKey }),
    plan: async () => ({ action: "BLOCKED", reason: "HASH_MISMATCH", draftRole: "USER" }),
    write: async () => ({ action: "CREATE", targetId: "u1" }),
  };
  const result = await new UsersPhaseExecutor(deps).execute("wordpress-db:user:1", "CREATE", { mode: "RERUN" });
  assert.equal(result.outcome, "FAILED");
  assert.equal(result.error, "HASH_MISMATCH");
}

async function testOffersPlannerFailClosedStates(): Promise<void> {
  let writeCalls = 0;
  const candidate: OffersMigrationCandidate = {
    sourceRecordKey: "wordpress-db:hb-programs:18932",
    domainHashV2: HASH,
    dependencyPlan: {
      placeSourceRecordKey: "wordpress-db:places:1",
      businessSourceKey: null,
      placeReadiness: "EXISTS_NOW",
      businessReadiness: null,
    },
  };
  const make = (target: {
    lineageCount: number;
    targetExists: boolean;
    duplicateTarget: boolean;
    lineageDomainHash: string | null;
  }) =>
    new OffersPhaseExecutor({
      loadCandidate: async () => candidate,
      resolveTargetState: async () => target,
      resolveDependencies: async () => ({ ownerUserId: "u", placeId: "p", businessId: null, cityId: "c" }),
      write: async () => {
        writeCalls += 1;
        return { targetId: "o1" };
      },
    });

  // missing lineage → CREATE plan → forbidden on rerun
  {
    const executor = make({
      lineageCount: 0,
      targetExists: false,
      duplicateTarget: false,
      lineageDomainHash: null,
    });
    const result = await executor.execute(candidate.sourceRecordKey, "CREATE", { mode: "RERUN" });
    assert.equal(result.outcome, "FAILED");
    assert.equal(result.error, "RERUN_LIVE_CREATE_FORBIDDEN");
  }

  // duplicate lineage
  {
    const executor = make({
      lineageCount: 2,
      targetExists: true,
      duplicateTarget: false,
      lineageDomainHash: HASH,
    });
    const result = await executor.execute(candidate.sourceRecordKey, "CREATE", { mode: "RERUN" });
    assert.equal(result.outcome, "FAILED");
    assert.match(result.error ?? "", /DUPLICATE_LINEAGE/);
  }

  // missing target (lineage without target)
  {
    const executor = make({
      lineageCount: 1,
      targetExists: false,
      duplicateTarget: false,
      lineageDomainHash: HASH,
    });
    const result = await executor.execute(candidate.sourceRecordKey, "CREATE", { mode: "RERUN" });
    assert.equal(result.outcome, "PROTECTED_CONFLICT");
    assert.match(result.error ?? "", /LINEAGE_WITHOUT_TARGET/);
  }

  // hash drift
  {
    const executor = make({
      lineageCount: 1,
      targetExists: true,
      duplicateTarget: false,
      lineageDomainHash: "other-hash",
    });
    const result = await executor.execute(candidate.sourceRecordKey, "CREATE", { mode: "RERUN" });
    assert.equal(result.outcome, "PROTECTED_CONFLICT");
    assert.match(result.error ?? "", /HASH_MISMATCH|DOMAIN_HASH_CHANGED/);
  }

  // happy unchanged skip
  {
    writeCalls = 0;
    const executor = make({
      lineageCount: 1,
      targetExists: true,
      duplicateTarget: false,
      lineageDomainHash: HASH,
    });
    const apply = await executor.execute(candidate.sourceRecordKey, "CREATE", { mode: "APPLY" });
    assert.equal(apply.outcome, "FAILED");
    assert.equal(apply.error, "UNEXPECTED_PLAN_ACTION:SKIP_UNCHANGED");
    const rerun = await executor.execute(candidate.sourceRecordKey, "CREATE", { mode: "RERUN" });
    assert.equal(rerun.outcome, "SKIPPED");
    assert.equal(writeCalls, 0);
  }
}

async function testRepresentativePhasesShareRerunNormalization(): Promise<void> {
  const cases: Array<{
    label: string;
    execute: (mode: "APPLY" | "RERUN") => Promise<{ outcome: string; error?: string | null }>;
  }> = [];

  // Places
  {
    let writes = 0;
    const executor = new PlacesPhaseExecutor({
      loadCandidate: (sourceRecordKey) => ({
        sourceRecordKey,
        domainHash: HASH,
        dependencyPlan: { ownerUserSourceRecordKey: "wordpress-db:user:1" },
      }),
      resolveTargetState: async () => unchangedLineageTarget(),
      resolveDependencies: async () => ({ createdByUserId: "u1" }),
      write: async () => {
        writes += 1;
        return { targetId: "p1" };
      },
    });
    cases.push({
      label: "places",
      execute: async (mode) => {
        const before = writes;
        const result = await executor.execute("wordpress-db:places:5457", "CREATE", { mode });
        assert.equal(writes, before);
        return result;
      },
    });
  }

  // Routes
  {
    let writes = 0;
    const executor = new RoutesPhaseExecutor({
      loadCandidate: (key) => ({ sourceRecordKey: key, domainHash: HASH, slug: "s" }),
      resolveTargetState: async () => ({
        lineageCount: 1,
        targetCount: 1,
        lineageTargetExists: true,
        lineageDomainHash: HASH,
      }),
      write: async () => {
        writes += 1;
        return { targetId: "r1" };
      },
    });
    cases.push({
      label: "routes",
      execute: async (mode) => {
        const before = writes;
        const result = await executor.execute("wordpress-db:routes:1", "CREATE", { mode });
        assert.equal(writes, before);
        return result;
      },
    });
  }

  // Events
  {
    let writes = 0;
    const executor = new EventsPhaseExecutor({
      loadCandidate: (key) => ({
        sourceRecordKey: key,
        domainHash: HASH,
        ownerUserSourceRecordKey: "wordpress-db:user:1",
        placeSourceRecordKey: null,
      }),
      resolveTargetState: async () => unchangedLineageTarget(),
      write: async () => {
        writes += 1;
        return { targetId: "e1" };
      },
    });
    cases.push({
      label: "events",
      execute: async (mode) => {
        const before = writes;
        const result = await executor.execute("wordpress-db:events:1", "CREATE", { mode });
        assert.equal(writes, before);
        return result;
      },
    });
  }

  // Articles
  {
    let writes = 0;
    const executor = new ArticlesPhaseExecutor({
      loadCandidate: (key) => ({ sourceRecordKey: key, domainHash: HASH }),
      resolveTargetState: async () => unchangedLineageTarget(),
      write: async () => {
        writes += 1;
        return { targetId: "a1" };
      },
    });
    cases.push({
      label: "articles",
      execute: async (mode) => {
        const before = writes;
        const result = await executor.execute("wordpress-db:post:1", "CREATE", { mode });
        assert.equal(writes, before);
        return result;
      },
    });
  }

  for (const item of cases) {
    const apply = await item.execute("APPLY");
    assert.equal(apply.outcome, "FAILED", item.label);
    assert.equal(apply.error, "UNEXPECTED_PLAN_ACTION:SKIP_UNCHANGED", item.label);
    const rerun = await item.execute("RERUN");
    assert.equal(rerun.outcome, "SKIPPED", item.label);
  }
}

async function testAdapterRerunPassesModeAndSkipsWriters(): Promise<void> {
  let writeCalls = 0;
  const executor = new UsersPhaseExecutor({
    loadCandidate: (sourceRecordKey) => ({ sourceRecordKey }),
    plan: async () => ({ action: "SKIP_UNCHANGED", reason: null, draftRole: "USER" }),
    write: async () => {
      writeCalls += 1;
      return { action: "CREATE", targetId: "u1" };
    },
  });
  const adapter = new SequentialEntityPhaseAdapter(executor);
  const phase = phaseFixture("users", ["wordpress-db:user:1", "wordpress-db:user:2"]);

  const applyResults = await adapter.apply(phase);
  assert.equal(applyResults[0]?.outcome, "FAILED");
  assert.equal(applyResults[0]?.error, "UNEXPECTED_PLAN_ACTION:SKIP_UNCHANGED");
  assert.equal(writeCalls, 0);

  const rerunResults = await adapter.rerun(phase);
  assert.equal(rerunResults.length, 2);
  assert.ok(rerunResults.every((result) => result.outcome === "SKIPPED"));
  assert.equal(writeCalls, 0);
}

async function main(): Promise<void> {
  testHelperGates();
  await testUsersRerunAcceptsCreateAsSkipAndApplyStillRejects();
  await testUsersRerunBlocksLiveCreate();
  await testUsersRerunBlocksUnexpectedUpdateLikeAction();
  await testOffersPlannerFailClosedStates();
  await testRepresentativePhasesShareRerunNormalization();
  await testAdapterRerunPassesModeAndSkipsWriters();
  console.log("Phoenix rerun idempotency tests: OK");
}

void main();

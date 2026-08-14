import assert from "node:assert/strict";
import { EventsFreshTargetPhaseAdapter, EventsPhaseExecutor, planEventsCreateAction, type EventsMigrationDependencies } from "./eventsAdapter";
import type { PhoenixReleasePhase } from "../types";

const HASH = "wordpress-db-domain-v2:fixture";
const candidate = (key: string) => ({ sourceRecordKey: key, domainHash: HASH, ownerUserSourceRecordKey: "wordpress-db:user:1", placeSourceRecordKey: null });
const clean = { lineageCount: 0, targetExists: false, lineageDomainHash: null, duplicateLineageTarget: false };
const phase: PhoenixReleasePhase = { name: "events", status: "READY", artifacts: [], records: Array.from({ length: 8 }, (_, i) => ({ sourceRecordKey: `wordpress-db:events:${i + 1}`, action: "CREATE" as const })), protectedSourceRecordKeys: [], excludedSourceRecordKeys: [], deterministicConflicts: [], mediaPolicy: "NONE", prerequisites: [] };

function deps(overrides: Partial<EventsMigrationDependencies> = {}): EventsMigrationDependencies {
  return { loadCandidate: candidate, resolveTargetState: async () => clean, write: async () => ({ targetId: "activity-1" }), ...overrides };
}

async function main(): Promise<void> {
  assert.deepEqual(planEventsCreateAction(HASH, clean), { action: "CREATE", reason: null });
  assert.deepEqual(planEventsCreateAction(HASH, { lineageCount: 1, targetExists: false, lineageDomainHash: HASH, duplicateLineageTarget: false }), { action: "CONFLICT", reason: "LINEAGE_WITHOUT_TARGET" });
  assert.deepEqual(planEventsCreateAction(HASH, { lineageCount: 1, targetExists: true, lineageDomainHash: HASH, duplicateLineageTarget: false }), { action: "SKIP_UNCHANGED", reason: null });
  assert.deepEqual(planEventsCreateAction(HASH, { lineageCount: 1, targetExists: true, lineageDomainHash: "other", duplicateLineageTarget: false }), { action: "CONFLICT", reason: "HASH_MISMATCH" });
  assert.equal(planEventsCreateAction(HASH, { ...clean, lineageCount: 2 }).reason, "DUPLICATE_LINEAGE");
  assert.equal(planEventsCreateAction(HASH, { ...clean, duplicateLineageTarget: true }).reason, "DUPLICATE_LINEAGE_TARGET");

  let writes = 0;
  const passing = new EventsFreshTargetPhaseAdapter(async () => ({ ok: true, blocker: null, activityWithoutLineageIds: [], duplicateSourceRecordKeys: [], duplicateTargetIds: [], missingTargetIds: [] }), new EventsPhaseExecutor(deps({ write: async () => { writes += 1; return { targetId: `a${writes}` }; } })));
  const results = await passing.apply(phase);
  assert.equal(results.length, 8); assert.equal(writes, 8, "clean target plans and writes all 8 CREATE records");

  writes = 0;
  const blocked = new EventsFreshTargetPhaseAdapter(async () => ({ ok: false, blocker: "EVENTS_UNCLASSIFIABLE_TARGET_STATE", activityWithoutLineageIds: ["safe-id"], duplicateSourceRecordKeys: [], duplicateTargetIds: [], missingTargetIds: [] }), new EventsPhaseExecutor(deps({ write: async () => { writes += 1; return { targetId: "never" }; } })));
  const blockedResults = await blocked.apply(phase);
  assert.equal(blockedResults[0].error, "EVENTS_UNCLASSIFIABLE_TARGET_STATE"); assert.equal(writes, 0);

  const seen: string[] = [];
  const stopping = new EventsFreshTargetPhaseAdapter(async () => ({ ok: true, blocker: null, activityWithoutLineageIds: [], duplicateSourceRecordKeys: [], duplicateTargetIds: [], missingTargetIds: [] }), new EventsPhaseExecutor(deps({
    resolveTargetState: async (c) => c.sourceRecordKey.endsWith(":2") ? { ...clean, lineageCount: 2 } : clean,
    write: async (c) => { seen.push(c.sourceRecordKey); return { targetId: "a" }; },
  })));
  const stopped = await stopping.apply(phase);
  assert.equal(stopped.length, 2); assert.deepEqual(seen, ["wordpress-db:events:1"]);

  // Production EventsFreshTargetPhaseAdapter must pass RERUN mode through to the executor.
  writes = 0;
  const unchanged = { lineageCount: 1, targetExists: true, lineageDomainHash: HASH, duplicateLineageTarget: false };
  const idempotent = new EventsFreshTargetPhaseAdapter(
    async () => ({ ok: true, blocker: null, activityWithoutLineageIds: [], duplicateSourceRecordKeys: [], duplicateTargetIds: [], missingTargetIds: [] }),
    new EventsPhaseExecutor(deps({
      resolveTargetState: async () => unchanged,
      write: async () => { writes += 1; return { targetId: "never" }; },
    })),
  );
  const applyReject = await idempotent.apply(phase);
  assert.equal(applyReject[0]?.outcome, "FAILED");
  assert.equal(applyReject[0]?.error, "UNEXPECTED_PLAN_ACTION:SKIP_UNCHANGED");
  assert.equal(writes, 0);
  const rerunSkip = await idempotent.rerun(phase);
  assert.equal(rerunSkip.length, 8);
  assert.ok(rerunSkip.every((r) => r.outcome === "SKIPPED"));
  assert.equal(writes, 0);
  const liveCreateBlocked = await new EventsFreshTargetPhaseAdapter(
    async () => ({ ok: true, blocker: null, activityWithoutLineageIds: [], duplicateSourceRecordKeys: [], duplicateTargetIds: [], missingTargetIds: [] }),
    new EventsPhaseExecutor(deps({
      resolveTargetState: async () => clean,
      write: async () => { writes += 1; return { targetId: "never" }; },
    })),
  ).rerun(phase);
  assert.equal(liveCreateBlocked[0]?.outcome, "FAILED");
  assert.equal(liveCreateBlocked[0]?.error, "RERUN_LIVE_CREATE_FORBIDDEN");
  assert.equal(writes, 0);

  console.log("Phoenix Events adapter tests: PASS");
}
void main();

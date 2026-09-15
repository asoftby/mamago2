/**
 * Tests for replaceActivitySessionsFromScheduleJson()'s import-session
 * guard (BACKLOG-154): the function must refuse to touch ActivitySession
 * rows at all — no deleteMany, no createMany — whenever the target
 * Activity already has any session with a non-null `source`
 * (import-created, e.g. ABWS). This is the single choke-point fix
 * replacing the per-caller checks from PR #298 (events/[id]/route.ts) and
 * PR #302 (activity.service.ts's updateActivity()) — every current and
 * future caller of this shared function now inherits the same guard.
 *
 * Also covers the two follow-up fixes from automated review on PR #303:
 * (1) the delete is scoped to `source: null` so a session that lands
 * between the read and the delete can never be destroyed by a race, and
 * (2) the return value distinguishes "skipped because imported sessions
 * exist" from "genuinely wrote 0 sessions", so callers can report a skip
 * honestly instead of as a successful resync.
 *
 * Fake prisma objects only, same style as
 * recurringScheduleMaterialization.test.ts's testWriterPersistsExactOccurrences.
 *
 * Запуск: npx tsx src/lib/business/syncEventActivitySessions.test.ts
 */
import assert from "node:assert/strict";
import { replaceActivitySessionsFromScheduleJson } from "./syncEventActivitySessions";

const SIMPLE_SCHEDULE = {
  scheduleItems: [{ date: "2026-10-01", startTime: "10:00" }],
};

function makeFakePrisma(existingSessions: Array<{ source: string | null }>) {
  const calls = {
    deleteManyCalled: false,
    createManyCalled: false,
    deleteManyWhere: undefined as unknown,
  };
  const prisma = {
    activitySession: {
      findMany: async () => existingSessions,
      deleteMany: async (args: { where: unknown }) => {
        calls.deleteManyCalled = true;
        calls.deleteManyWhere = args.where;
        return { count: 0 };
      },
      createMany: async (args: { data: unknown[] }) => {
        calls.createManyCalled = true;
        return { count: args.data.length };
      },
    },
  };
  return { prisma, calls };
}

async function testSkipsEntirelyWhenAnyImportedSessionExists() {
  const { prisma, calls } = makeFakePrisma([
    { source: null },
    { source: "abws-performances-event" },
  ]);

  const result = await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-imported",
    scheduleJson: SIMPLE_SCHEDULE,
  });

  assert.deepEqual(result, { count: 0, skipped: true }, "must report a skip, not a successful empty write");
  assert.equal(calls.deleteManyCalled, false, "must never call deleteMany when any session is imported");
  assert.equal(calls.createManyCalled, false, "must never call createMany when any session is imported");
}

async function testProceedsNormallyWhenNoSessionHasSource() {
  const { prisma, calls } = makeFakePrisma([{ source: null }]);

  const result = await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-ordinary",
    scheduleJson: SIMPLE_SCHEDULE,
  });

  assert.deepEqual(
    result,
    { count: 1, skipped: false },
    "an ordinary activity's resync must still write the new occurrence",
  );
  assert.equal(calls.deleteManyCalled, true, "must delete the old sessions as before this fix");
  assert.equal(calls.createManyCalled, true, "must create the new sessions as before this fix");
}

async function testProceedsNormallyWhenNoSessionsExistYet() {
  const { prisma, calls } = makeFakePrisma([]);

  const result = await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-new",
    scheduleJson: SIMPLE_SCHEDULE,
  });

  assert.deepEqual(
    result,
    { count: 1, skipped: false },
    "a brand-new activity with no sessions yet must still get them created",
  );
  assert.equal(calls.deleteManyCalled, true);
  assert.equal(calls.createManyCalled, true);
}

async function testDeleteIsScopedToSourceNull() {
  // Closes the TOCTOU race found on PR #303 review: even though the guard
  // above decides "proceed" based on a read that already happened, the
  // actual deleteMany must be scoped to source: null so a session that
  // lands between the read and this delete (a concurrent ABWS upsert)
  // can never be removed by it, regardless of transaction isolation.
  const { prisma, calls } = makeFakePrisma([{ source: null }]);

  await replaceActivitySessionsFromScheduleJson({
    prisma: prisma as never,
    activityId: "activity-race",
    scheduleJson: SIMPLE_SCHEDULE,
  });

  assert.deepEqual(
    calls.deleteManyWhere,
    { activityId: "activity-race", source: null },
    "deleteMany must filter on source: null, never a bare activityId-only delete",
  );
}

async function main() {
  await testSkipsEntirelyWhenAnyImportedSessionExists();
  await testProceedsNormallyWhenNoSessionHasSource();
  await testProceedsNormallyWhenNoSessionsExistYet();
  await testDeleteIsScopedToSourceNull();
  console.log("syncEventActivitySessions tests: OK");
}

main().catch((error) => {
  console.error("syncEventActivitySessions tests: FAILED", error);
  process.exitCode = 1;
});

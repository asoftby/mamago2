import assert from "node:assert/strict";
import test from "node:test";
import { AnalyticsEntityType, RecommendationSurface } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  NARROW_EXPOSURES_MAX_AGE_MS,
  narrowRunExposuresToShown,
  recordRecommendationRun,
} from "./RecommendationTraceService";

const INTENT = "related_event_suggestions";
const created: string[] = [];

async function makeRun(userId: string | null, ids: string[], intent = INTENT) {
  const run = await recordRecommendationRun({
    userId,
    surface: RecommendationSurface.DISCOVERY,
    algorithmVersion: "narrow-test",
    candidateCount: ids.length,
    items: ids.map((entityId, index) => ({
      entityType: AnalyticsEntityType.EVENT,
      entityId,
      position: index + 1,
      score: 1 - index / 10,
      reasonCodes: ["TEST"],
    })),
    decisionContext: {
      intent: intent as never,
      subjects: [],
      constraints: {},
      actor: { kind: userId ? "user" : "guest", id: userId },
    },
  });
  assert.ok(run, "run recorded");
  created.push(run.runId);
  return run.runId;
}

async function exposures(runId: string) {
  const rows = await prisma.recommendationExposure.findMany({
    where: { runId },
    orderBy: { position: "asc" },
    select: { entityId: true, position: true },
  });
  const run = await prisma.recommendationRun.findUniqueOrThrow({ where: { id: runId }, select: { selectedCount: true } });
  return { rows, selectedCount: run.selectedCount };
}

test.after(async () => {
  await prisma.recommendationRun.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
});

test("narrows a guest run to the shown ids, renumbers positions and updates selectedCount", async () => {
  const runId = await makeRun(null, ["a", "b", "c", "d", "e", "f"]);
  const result = await narrowRunExposuresToShown({
    runId,
    entityType: AnalyticsEntityType.EVENT,
    shownEntityIds: ["c", "a"],
    actorUserId: null,
    intent: INTENT,
  });
  assert.deepEqual(result, { ok: true, kept: 2, removed: 4 });
  const after = await exposures(runId);
  assert.deepEqual(after.rows, [
    { entityId: "c", position: 1 },
    { entityId: "a", position: 2 },
  ]);
  assert.equal(after.selectedCount, 2);

  // Повтор идемпотентен.
  const again = await narrowRunExposuresToShown({
    runId,
    entityType: AnalyticsEntityType.EVENT,
    shownEntityIds: ["c", "a"],
    actorUserId: null,
    intent: INTENT,
  });
  assert.deepEqual(again, { ok: true, kept: 2, removed: 0 });
});

test("never adds exposures and an empty shown list clears the run", async () => {
  const runId = await makeRun(null, ["a", "b"]);
  const result = await narrowRunExposuresToShown({
    runId,
    entityType: AnalyticsEntityType.EVENT,
    shownEntityIds: ["zzz"],
    actorUserId: null,
    intent: INTENT,
  });
  assert.deepEqual(result, { ok: true, kept: 0, removed: 2 });
  assert.equal((await exposures(runId)).rows.length, 0);
});

test("a signed-in user's run can only be narrowed by that user", async () => {
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const runId = await makeRun(user.id, ["a", "b", "c"]);
  for (const actorUserId of [null, "someone-else"]) {
    const denied = await narrowRunExposuresToShown({
      runId,
      entityType: AnalyticsEntityType.EVENT,
      shownEntityIds: ["a"],
      actorUserId,
      intent: INTENT,
    });
    assert.deepEqual(denied, { ok: false, reason: "forbidden" });
  }
  assert.equal((await exposures(runId)).rows.length, 3);
  const ok = await narrowRunExposuresToShown({
    runId,
    entityType: AnalyticsEntityType.EVENT,
    shownEntityIds: ["a"],
    actorUserId: user.id,
    intent: INTENT,
  });
  assert.deepEqual(ok, { ok: true, kept: 1, removed: 2 });
});

test("rejects other intents, expired runs, unknown runs and oversized payloads", async () => {
  const otherIntent = await makeRun(null, ["a", "b"], "my_plan_suggestions");
  assert.deepEqual(
    await narrowRunExposuresToShown({
      runId: otherIntent,
      entityType: AnalyticsEntityType.EVENT,
      shownEntityIds: ["a"],
      actorUserId: null,
      intent: INTENT,
    }),
    { ok: false, reason: "forbidden" },
  );

  const runId = await makeRun(null, ["a", "b"]);
  assert.deepEqual(
    await narrowRunExposuresToShown({
      runId,
      entityType: AnalyticsEntityType.EVENT,
      shownEntityIds: ["a"],
      actorUserId: null,
      intent: INTENT,
      now: new Date(Date.now() + NARROW_EXPOSURES_MAX_AGE_MS + 60_000),
    }),
    { ok: false, reason: "expired" },
  );
  assert.deepEqual(
    await narrowRunExposuresToShown({
      runId: "missing-run-id",
      entityType: AnalyticsEntityType.EVENT,
      shownEntityIds: [],
      actorUserId: null,
      intent: INTENT,
    }),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(
    await narrowRunExposuresToShown({
      runId,
      entityType: AnalyticsEntityType.EVENT,
      shownEntityIds: Array.from({ length: 21 }, (_, i) => `id${i}`),
      actorUserId: null,
      intent: INTENT,
    }),
    { ok: false, reason: "invalid" },
  );
  assert.equal((await exposures(runId)).rows.length, 2);
});

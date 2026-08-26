import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { computePlanFingerprint } from "@/server/services/dayScenario.service";
import {
  saveScenarioDraftForUser,
  ScenarioSaveError,
  type SaveIntent,
} from "./route";

const marker = randomUUID();
const userIds: string[] = [];
const activityIds: string[] = [];

async function createUser(label: string) {
  const user = await prisma.user.create({
    data: { email: `scenario-save-${label}-${marker}@example.invalid` },
    select: { id: true },
  });
  userIds.push(user.id);
  return user.id;
}

async function createActivity(ownerUserId: string, label: string, hour: number) {
  const startsAt = new Date(`2026-10-12T${String(hour).padStart(2, "0")}:00:00.000Z`);
  const activity = await prisma.activity.create({
    data: {
      ownerUserId,
      title: `${label} ${marker}`,
      shortDesc: "scenario save integration fixture",
      type: "EVENT",
      status: "PUBLISHED",
      scheduleMode: "ONE_TIME",
      schedulingKind: "SLOT",
      scheduleJson: { durationMinutes: 120 },
      sessions: { create: { startsAt } },
    },
    select: { id: true, title: true, sessions: { select: { id: true, startsAt: true } } },
  });
  activityIds.push(activity.id);
  return { ...activity, session: activity.sessions[0]! };
}

async function createScenario(userId: string, scenarioDate: string, activities: Awaited<ReturnType<typeof createActivity>>[]) {
  const items = [];
  for (const activity of activities) {
    items.push(await prisma.planItem.create({
      data: {
        userId,
        date: scenarioDate,
        activityId: activity.id,
        startsAt: activity.session.startsAt,
        title: activity.title,
      },
    }));
  }
  const planFingerprint = computePlanFingerprint(items);
  await prisma.dayScenario.create({ data: { userId, date: scenarioDate, planFingerprint } });
  return { items, planFingerprint };
}

function expectCode(code: string) {
  return (error: unknown) => error instanceof ScenarioSaveError && error.code === code;
}

async function main() {
  try {
    const user = await createUser("owner");
    const foreignUser = await createUser("foreign");
    const oldA = await createActivity(user, "old-a", 7);
    const oldB = await createActivity(user, "old-b", 11);
    const retained = await createActivity(user, "retained", 9);
    const replacement = await createActivity(user, "replacement", 9);
    const invalidDraftActivity = await createActivity(user, "invalid-draft", 13);
    await prisma.activity.update({ where: { id: invalidDraftActivity.id }, data: { status: "DRAFT" } });

    // One invalid replacement rolls the entire transaction back.
    const rollbackDate = "2026-10-12";
    const rollback = await createScenario(user, rollbackDate, [oldA, oldB]);
    const rollbackIntent: SaveIntent = {
      date: rollbackDate,
      baseFingerprint: rollback.planFingerprint,
      replacements: [
        { planItemId: rollback.items[0]!.id, newActivityId: replacement.id, activitySessionId: replacement.session.id },
        { planItemId: rollback.items[1]!.id, newActivityId: invalidDraftActivity.id, activitySessionId: invalidDraftActivity.session.id },
      ],
      removals: [],
      acceptedConflictKeys: [],
    };
    await assert.rejects(() => saveScenarioDraftForUser(user, rollbackIntent, randomUUID()), expectCode("INVALID_REPLACEMENT"));
    const afterRollback = await prisma.planItem.findMany({ where: { userId: user, date: rollbackDate }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(afterRollback.map((item) => item.activityId), [oldA.id, oldB.id], "invalid draft must apply nothing");

    // Foreign target is never addressable through the owner's scenario.
    const foreignItem = await prisma.planItem.create({ data: { userId: foreignUser, date: rollbackDate, title: "foreign" } });
    await assert.rejects(
      () => saveScenarioDraftForUser(user, { ...rollbackIntent, replacements: [], removals: [foreignItem.id] }, randomUUID()),
      expectCode("INVALID_PLAN_ITEM"),
    );

    // Replace + remove + accepted conflict are committed as one canonical result.
    await prisma.dayScenario.delete({ where: { userId_date: { userId: user, date: rollbackDate } } });
    await prisma.planItem.deleteMany({ where: { userId: user, date: rollbackDate } });
    const success = await createScenario(user, rollbackDate, [oldA, oldB, retained]);
    const acceptedKey = [
      `${success.items[0]!.id}@${replacement.id}`,
      `${success.items[2]!.id}@${retained.id}`,
    ].sort().join(":");
    const successIntent: SaveIntent = {
      date: rollbackDate,
      baseFingerprint: success.planFingerprint,
      replacements: [{ planItemId: success.items[0]!.id, newActivityId: replacement.id, activitySessionId: replacement.session.id }],
      removals: [success.items[1]!.id],
      acceptedConflictKeys: [`TIME_OVERLAP:${acceptedKey}`],
    };
    const key = randomUUID();
    const first = await saveScenarioDraftForUser(user, successIntent, key) as Record<string, unknown>;
    const second = await saveScenarioDraftForUser(user, successIntent, key) as Record<string, unknown>;
    assert.deepEqual(second, first, "same key and logical request returns the stored successful outcome");
    const persisted = await prisma.planItem.findMany({ where: { userId: user, date: rollbackDate } });
    assert.equal(persisted.length, 2);
    assert.ok(persisted.some((item) => item.activityId === replacement.id));
    assert.ok(!persisted.some((item) => item.id === success.items[1]!.id));
    assert.deepEqual(first.acceptedConflictKeys, [`TIME_OVERLAP:${acceptedKey}`]);

    await assert.rejects(
      () => saveScenarioDraftForUser(user, successIntent, randomUUID()),
      expectCode("PLAN_CHANGED"),
      "old payload with a different key must observe optimistic concurrency",
    );
    await assert.rejects(
      () => saveScenarioDraftForUser(user, { ...successIntent, removals: [] }, key),
      expectCode("IDEMPOTENCY_KEY_REUSED"),
      "one key cannot represent another logical request",
    );

    // An Activity already saved on another date cannot be moved or duplicated.
    const duplicateDate = "2026-10-13";
    const duplicateBase = await createScenario(user, duplicateDate, [oldB]);
    await assert.rejects(
      () => saveScenarioDraftForUser(user, {
        date: duplicateDate,
        baseFingerprint: duplicateBase.planFingerprint,
        replacements: [{ planItemId: duplicateBase.items[0]!.id, newActivityId: replacement.id, activitySessionId: replacement.session.id }],
        removals: [], acceptedConflictKeys: [],
      }, randomUUID()),
      expectCode("DUPLICATE_ACTIVITY"),
    );
    assert.equal((await prisma.planItem.findUnique({ where: { id: duplicateBase.items[0]!.id } }))?.activityId, oldB.id);

    // Real parallel retry: row lock serializes the requests and both receive one result.
    const concurrentDate = "2026-10-14";
    const concurrentBase = await createScenario(user, concurrentDate, [oldA]);
    const concurrentIntent: SaveIntent = {
      date: concurrentDate,
      baseFingerprint: concurrentBase.planFingerprint,
      replacements: [], removals: [concurrentBase.items[0]!.id], acceptedConflictKeys: [],
    };
    const concurrentKey = randomUUID();
    const [concurrentA, concurrentB] = await Promise.all([
      saveScenarioDraftForUser(user, concurrentIntent, concurrentKey),
      saveScenarioDraftForUser(user, concurrentIntent, concurrentKey),
    ]);
    assert.deepEqual(concurrentA, concurrentB);
    assert.equal(await prisma.planItem.count({ where: { id: concurrentBase.items[0]!.id } }), 0);

    console.log("scenario atomic save integration tests: OK");
  } finally {
    await prisma.dayScenario.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.planItem.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

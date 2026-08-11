/**
 * Integration tests for Task 7 (Day Scenario) persistence:
 * computePlanFingerprint/getDayScenario/ensureDayScenario/refreshDayScenario
 * (src/server/services/dayScenario.service.ts). Self-generated fixtures
 * (2 users + 1 activity), cleaned up in a finally block. Exercises the real
 * functions against the local dev DB.
 *
 * Run: set -a; source .env; set +a; npx tsx src/server/services/dayScenario.service.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  computePlanFingerprint,
  getDayScenario,
  ensureDayScenario,
  refreshDayScenario,
} from "@/server/services/dayScenario.service";

async function main() {
  const marker = randomUUID();
  const createdUserIds: string[] = [];
  const date = "2026-09-01";

  async function createUser(label: string) {
    const user = await prisma.user.create({
      data: { email: `day-scenario-${label}-${marker}@example.invalid` },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function createPlanItem(userId: string, startsAt: Date | null) {
    return prisma.planItem.create({
      data: { userId, date, startsAt, title: `Activity ${marker}` },
      select: { id: true, startsAt: true },
    });
  }

  try {
    const userA = await createUser("user-a");
    const userB = await createUser("user-b");

    // ── computePlanFingerprint: deterministic, order-independent ──
    const a = { id: "x", startsAt: new Date("2026-09-01T10:00:00Z") };
    const b = { id: "y", startsAt: null };
    assert.equal(
      computePlanFingerprint([a, b]),
      computePlanFingerprint([b, a]),
      "fingerprint must not depend on input order",
    );
    assert.notEqual(
      computePlanFingerprint([a, b]),
      computePlanFingerprint([a]),
      "fingerprint must change when the item set changes",
    );
    assert.notEqual(
      computePlanFingerprint([a]),
      computePlanFingerprint([{ id: "x", startsAt: new Date("2026-09-01T11:00:00Z") }]),
      "fingerprint must change when startsAt changes",
    );

    // ── ensureDayScenario: create, idempotent, no duplicate row ──
    assert.equal(await getDayScenario(userA, date), null, "starts unscheduled");

    const item1 = await createPlanItem(userA, new Date("2026-09-01T10:00:00Z"));
    const item2 = await createPlanItem(userA, new Date("2026-09-01T14:00:00Z"));
    const item3 = await createPlanItem(userA, null);
    const items = [item1, item2, item3];

    const created = await ensureDayScenario(userA, date, items);
    assert.ok(created.id);
    assert.equal(created.userId, userA);
    assert.equal(created.date, date);
    assert.equal(created.planFingerprint, computePlanFingerprint(items));

    // Idempotent: calling again must return the same row, not a new one.
    const again = await ensureDayScenario(userA, date, items);
    assert.equal(again.id, created.id, "ensureDayScenario must not create a duplicate row");

    const rows = await prisma.dayScenario.findMany({ where: { userId: userA, date } });
    assert.equal(rows.length, 1, "exactly one Scenario row per user/date");

    // Duplicate-request safety net: DB unique constraint rejects a raw duplicate create.
    await assert.rejects(
      () =>
        prisma.dayScenario.create({
          data: { userId: userA, date, planFingerprint: "whatever" },
        }),
      "unique constraint must prevent a second row for the same user/date",
    );

    // ── Cross-user isolation ──
    assert.equal(
      await getDayScenario(userB, date),
      null,
      "another user must not see userA's Scenario",
    );
    const userBScenario = await ensureDayScenario(userB, date, []);
    assert.notEqual(userBScenario.id, created.id, "each user gets their own row");
    const userARows = await prisma.dayScenario.findMany({ where: { userId: userA } });
    assert.equal(userARows.length, 1, "creating userB's Scenario must not affect userA's");

    // A wrong-user refresh can never touch userA's row: refreshDayScenario is
    // always scoped by the (userId, date) the caller passes in, never by a
    // client-supplied Scenario id, so userB "refreshing" userA's date only
    // ever reaches userB's own (already-created) row.
    const userAFingerprintBefore = (await getDayScenario(userA, date))?.planFingerprint;
    await refreshDayScenario(userB, date, []);
    assert.equal(
      (await getDayScenario(userA, date))?.planFingerprint,
      userAFingerprintBefore,
      "another user's refresh must not alter userA's Scenario",
    );

    // ── refreshDayScenario: recomputes + persists the fingerprint ──
    const noOp = await refreshDayScenario(userA, "2026-12-31", items);
    assert.equal(noOp, null, "refresh is a no-op when no Scenario exists for that date");

    const changedItems = [item1, item2]; // item3 "removed" from My Plan
    const beforeRefresh = await getDayScenario(userA, date);
    assert.equal(beforeRefresh?.planFingerprint, computePlanFingerprint(items));
    assert.notEqual(
      beforeRefresh?.planFingerprint,
      computePlanFingerprint(changedItems),
      "fingerprint must diverge once the Plan Item set changes (plan changed)",
    );

    const refreshed = await refreshDayScenario(userA, date, changedItems);
    assert.equal(refreshed?.id, created.id, "refresh updates the existing row, not a new one");
    assert.equal(
      refreshed?.planFingerprint,
      computePlanFingerprint(changedItems),
      "refresh must persist the recomputed fingerprint",
    );

    console.log("dayScenario service tests: OK");
  } finally {
    await prisma.dayScenario.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.planItem.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

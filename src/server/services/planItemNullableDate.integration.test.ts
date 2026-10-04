import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  listAllPlanItems,
  listPlanItemsByDate,
  listPlanItemsByWeek,
  listPlanItemsDueForReminder,
  listPlanItemsInRange,
  listUpcomingPlanItems,
  removePlanItem,
} from "./plan.service";
import {
  confirmPlanExperience,
  ExperienceDomainError,
  listPendingExperienceCandidates,
} from "./experience/experience.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at an isolated test database");
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const marker = randomUUID();

async function main() {
  const owner = await prisma.user.create({
    data: { email: `nullable-date-${marker}@example.invalid` },
  });
  const activity = await prisma.activity.create({
    data: {
      ownerUserId: owner.id,
      title: `Nullable date ${marker}`,
      shortDesc: "fixture",
      type: "EVENT",
      scheduleMode: "ONE_TIME",
      ageTags: [],
    },
  });

  try {
    const dated = await prisma.planItem.create({
      data: { userId: owner.id, activityId: activity.id, date: "2026-10-10" },
    });
    const undatedActivity = await prisma.planItem.create({
      data: {
        userId: owner.id,
        activityId: activity.id,
        date: null,
        startsAt: new Date("2026-10-10T09:00:00.000Z"),
      },
    });
    const undatedPlace = await prisma.planItem.create({
      data: { userId: owner.id, date: null, planPlaceSlug: `place-${marker}` },
    });
    const undatedIds = new Set([undatedActivity.id, undatedPlace.id]);

    // No list, day/week/range view or reminder ever shows an undated row.
    const all = await listAllPlanItems(owner.id);
    assert.deepEqual(all.map((item) => item.id), [dated.id]);
    assert.equal(all.every((item) => typeof item.date === "string"), true);

    for (const items of [
      await listPlanItemsByDate(owner.id, "2026-10-10"),
      await listPlanItemsByWeek(owner.id, "2026-10-05"),
      await listPlanItemsInRange(owner.id, "2026-10-01", "2026-10-31"),
      await listUpcomingPlanItems(owner.id, "2026-10-01"),
    ]) {
      assert.deepEqual(items.map((item) => item.id), [dated.id]);
    }

    const reminders = await listPlanItemsDueForReminder({
      windowStart: new Date("2026-10-10T00:00:00.000Z"),
      windowEnd: new Date("2026-10-10T23:59:59.000Z"),
    });
    assert.equal(reminders.some((item) => undatedIds.has(item.id)), false);

    // Undated rows are never check-in candidates and cannot be confirmed.
    const pending = await listPendingExperienceCandidates({
      userId: owner.id,
      today: "2026-12-01",
      lookbackDays: 90,
      take: 10,
    });
    assert.equal(pending.some((item) => undatedIds.has(item.planItemId)), false);
    await assert.rejects(
      confirmPlanExperience({
        userId: owner.id,
        planItemId: undatedActivity.id,
        attendance: "ATTENDED",
        today: "2026-12-01",
      }),
      (error) => {
        assert.ok(error instanceof ExperienceDomainError);
        assert.equal(error.code, "undated_plan_item");
        return true;
      },
    );
    assert.equal(
      await prisma.experience.count({ where: { sourcePlanItemId: undatedActivity.id } }),
      0,
    );

    // Undated rows can still be removed by their owner.
    await removePlanItem(owner.id, undatedPlace.id);
    assert.equal(await prisma.planItem.count({ where: { id: undatedPlace.id } }), 0);

    console.log("planItemNullableDate.integration.test.ts: OK");
  } finally {
    await prisma.experience.deleteMany({ where: { userId: owner.id } });
    await prisma.planItem.deleteMany({ where: { userId: owner.id } });
    await prisma.activity.delete({ where: { id: activity.id } });
    await prisma.user.delete({ where: { id: owner.id } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

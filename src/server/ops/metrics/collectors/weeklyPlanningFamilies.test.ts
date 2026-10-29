/**
 * weeklyPlanningFamilies collector test.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/weeklyPlanningFamilies.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { collectWeeklyPlanningFamilies } from "./weeklyPlanningFamilies";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const userIds: string[] = [];
const eventIds: string[] = [];
const planItemIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeUser(): Promise<string> {
    const user = await prisma.user.create({ data: { email: `wpf-test-${marker}-${randomUUID()}@example.invalid` } });
    userIds.push(user.id);
    return user.id;
  }

  try {
    const now = new Date("2019-04-10T12:00:00.000Z");

    const userCurrent = await makeUser();
    const currentEvent = await prisma.userEvent.create({
      data: { userId: userCurrent, eventType: "PLAN_ADD", createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
    });
    eventIds.push(currentEvent.id);

    const userPrev = await makeUser();
    const prevEvent = await prisma.userEvent.create({
      data: { userId: userPrev, eventType: "PLAN_ADD", createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) },
    });
    eventIds.push(prevEvent.id);

    // C3 acceptance: an entry written from the Telegram bot into "Мой план" (PlanItem without routeId, no UserEvent) raises WPF.
    const before = (await collectWeeklyPlanningFamilies({ prisma, now })).find((s) => s.metric === "planning.wpf")?.value;
    assert.equal(before, 1);
    const userBot = await makeUser();
    const botItem = await prisma.planItem.create({
      data: {
        userId: userBot,
        source: "TELEGRAM_FORWARD",
        entryType: "EVENT",
        title: "Утренник в саду",
        date: "2019-04-09",
        createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    });
    planItemIds.push(botItem.id);
    // SAVE is a bookmark, not planning: must not change WPF.
    const userSaveOnly = await makeUser();
    const saveEvent = await prisma.userEvent.create({
      data: { userId: userSaveOnly, eventType: "SAVE", createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    });
    eventIds.push(saveEvent.id);

    const samples = await collectWeeklyPlanningFamilies({ prisma, now });
    const current = samples.find((s) => s.metric === "planning.wpf");
    const done = samples.find((s) => s.metric === "planning.wpf_completed");
    const donePrev = samples.find((s) => s.metric === "planning.wpf_completed_prev");

    assert.equal(current?.value, 2, "current 7d window = userCurrent (PLAN_ADD) + userBot (bot PlanItem); SAVE-only user excluded");
    assert.equal(done?.value, 2, "completed window (7 full Minsk days ending last midnight) must count userCurrent and userBot");
    assert.equal(donePrev?.value, 1, "previous completed window must count only userPrev");
    assert.equal(samples.some((s) => s.metric === "planning.wpf_prev"), false, "legacy live-vs-previous metric is gone");
    assert.equal(current?.dimKey, undefined, "collector emits no dimKey -> global dimKey=''");

    console.log("weeklyPlanningFamilies.test.ts: OK");
  } finally {
    await prisma.planItem.deleteMany({ where: { id: { in: planItemIds } } });
    await prisma.userEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

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
      data: { userId: userCurrent, eventType: "SAVE", createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
    });
    eventIds.push(currentEvent.id);

    const userPrev = await makeUser();
    const prevEvent = await prisma.userEvent.create({
      data: { userId: userPrev, eventType: "SAVE", createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) },
    });
    eventIds.push(prevEvent.id);

    const samples = await collectWeeklyPlanningFamilies({ prisma, now });
    const current = samples.find((s) => s.metric === "planning.wpf");
    const prev = samples.find((s) => s.metric === "planning.wpf_prev");

    assert.equal(current?.value, 1, "current 7d window must count only userCurrent");
    assert.equal(prev?.value, 1, "previous 7d window must count only userPrev");
    assert.equal(current?.dimKey, undefined, "collector emits no dimKey -> global dimKey=''");

    console.log("weeklyPlanningFamilies.test.ts: OK");
  } finally {
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

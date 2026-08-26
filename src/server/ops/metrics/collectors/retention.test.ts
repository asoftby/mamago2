/**
 * retention collector test — W1/W4 registration-cohort retention.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/retention.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { addDateKeyDays, startOfZonedDay, zonedDateKey, zonedDayRange } from "@/lib/stories/ranges";
import { DEFAULT_TZ } from "@/server/geo/geoConstants";
import { collectRetention } from "./retention";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const userIds: string[] = [];
const eventIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeUser(createdAt: Date, role: "USER" | "ADMIN" = "USER"): Promise<string> {
    const user = await prisma.user.create({
      data: { email: `retention-test-${marker}-${randomUUID()}@example.invalid`, role, createdAt },
    });
    userIds.push(user.id);
    return user.id;
  }

  async function makeSave(userId: string, createdAt: Date) {
    const event = await prisma.userEvent.create({ data: { userId, eventType: "SAVE", createdAt } });
    eventIds.push(event.id);
  }

  try {
    const now = new Date("2019-05-15T09:00:00.000Z");
    const todayKey = zonedDateKey(now, DEFAULT_TZ);

    // --- W1 fixtures: cohort day D = today - 7 ---
    const w1CohortKey = addDateKeyDays(todayKey, -7);
    const w1CohortRange = zonedDayRange(w1CohortKey, 1, DEFAULT_TZ);
    const w1RegisteredAt = new Date(w1CohortRange.start.getTime() + 60 * 60 * 1000);
    const w1CheckStart = startOfZonedDay(addDateKeyDays(w1CohortKey, 2), DEFAULT_TZ);
    const w1DPlus1 = startOfZonedDay(addDateKeyDays(w1CohortKey, 1), DEFAULT_TZ);

    const userRetainedW1 = await makeUser(w1RegisteredAt);
    await makeSave(userRetainedW1, new Date(w1CheckStart.getTime() + 60 * 60 * 1000));

    const userNextDayOnlyW1 = await makeUser(w1RegisteredAt);
    // A same-day/next-day-only return must NOT count as retained.
    await makeSave(userNextDayOnlyW1, new Date(w1DPlus1.getTime() + 60 * 60 * 1000));

    const userNoReturnW1 = await makeUser(w1RegisteredAt);
    // No further activity.

    const userAdminW1 = await makeUser(w1RegisteredAt, "ADMIN");
    await makeSave(userAdminW1, new Date(w1CheckStart.getTime() + 60 * 60 * 1000));

    // --- W4 fixtures: cohort day D = today - 30 ---
    const w4CohortKey = addDateKeyDays(todayKey, -30);
    const w4CohortRange = zonedDayRange(w4CohortKey, 1, DEFAULT_TZ);
    const w4RegisteredAt = new Date(w4CohortRange.start.getTime() + 60 * 60 * 1000);
    const w4CheckStart = startOfZonedDay(addDateKeyDays(w4CohortKey, 22), DEFAULT_TZ);

    const userRetainedW4 = await makeUser(w4RegisteredAt);
    await makeSave(userRetainedW4, new Date(w4CheckStart.getTime() + 60 * 60 * 1000));

    const userNoReturnW4 = await makeUser(w4RegisteredAt);

    const samples = await collectRetention({ prisma, now });
    const w1 = samples.find((s) => s.metric === "retention.w1");
    const w4 = samples.find((s) => s.metric === "retention.w4");

    assert.ok(w1, "retention.w1 must be written for a non-empty cohort");
    assert.equal(w1!.value, 1 / 3, "cohort = {retained, nextDayOnly, noReturn} (ADMIN excluded); only 1 retained");

    assert.ok(w4, "retention.w4 must be written for a non-empty cohort");
    assert.equal(w4!.value, 0.5, "cohort = {retained, noReturn}; 1 of 2 retained");

    // Empty-cohort case: an arbitrary date far from any fixture in this
    // suite (or realistic dev data) must yield NO sample, never a
    // fabricated 0/0.
    const emptyNow = new Date("2019-09-01T09:00:00.000Z");
    const emptySamples = await collectRetention({ prisma, now: emptyNow });
    assert.equal(emptySamples.length, 0, "empty cohorts on all four offsets must write zero samples, not 0/0");

    console.log("retention.test.ts: OK");
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

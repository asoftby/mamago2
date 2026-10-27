/**
 * retention collector test — W1/W4 weekly ISO registration cohorts (C4).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/retention.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
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

  async function makeUser(createdAt: string, role: "USER" | "ADMIN" = "USER"): Promise<string> {
    const user = await prisma.user.create({
      data: { email: `retention-test-${marker}-${randomUUID()}@example.invalid`, role, createdAt: new Date(createdAt) },
    });
    userIds.push(user.id);
    return user.id;
  }

  async function planAdd(userId: string, createdAt: string) {
    const event = await prisma.userEvent.create({ data: { userId, eventType: "PLAN_ADD", createdAt: new Date(createdAt) } });
    eventIds.push(event.id);
  }

  try {
    // Wed 15 May 2019. Current ISO week starts Mon 13 May (Minsk, UTC+3).
    //   W1 cohort  = week of Mon 29 Apr, checked in the week of Mon 6 May.
    //   W1 prev    = week of Mon 22 Apr, checked in the week of Mon 29 Apr.
    //   W4 cohort  = week of Mon 8 Apr,  checked in the week of Mon 6 May.
    //   W4 prev    = week of Mon 1 Apr,  checked in the week of Mon 29 Apr.
    const now = new Date("2019-05-15T09:00:00.000Z");

    // --- W1 cohort (registered Mon 29 Apr 00:00 .. Sun 5 May 23:59 Minsk) ---
    const retained = await makeUser("2019-04-30T10:00:00.000Z");
    await planAdd(retained, "2019-05-08T10:00:00.000Z"); // in week N+1
    const sundayLate = await makeUser("2019-05-05T20:30:00.000Z"); // Sun 23:30 Minsk — still the cohort week
    await planAdd(sundayLate, "2019-05-06T05:00:00.000Z"); // Mon 08:00 Minsk, week N+1 — retained
    const sameWeekOnly = await makeUser("2019-04-30T10:00:00.000Z");
    await planAdd(sameWeekOnly, "2019-05-02T10:00:00.000Z"); // only in the registration week — NOT retained
    const noReturn = await makeUser("2019-05-01T10:00:00.000Z");
    const adminInCohort = await makeUser("2019-04-30T10:00:00.000Z", "ADMIN");
    await planAdd(adminInCohort, "2019-05-08T10:00:00.000Z"); // excluded role
    // Registered Mon 6 May 00:30 Minsk = next week's cohort, not this one.
    const nextWeekCohort = await makeUser("2019-05-05T21:30:00.000Z");
    await planAdd(nextWeekCohort, "2019-05-08T10:00:00.000Z");
    // A bookmark is not planning (C3).
    await prisma.userEvent
      .create({ data: { userId: noReturn, eventType: "SAVE", createdAt: new Date("2019-05-08T10:00:00.000Z") } })
      .then((e) => eventIds.push(e.id));

    // --- W1 prev cohort (week of 22 Apr): 2 users, 1 retained in week of 29 Apr ---
    const prevRetained = await makeUser("2019-04-23T10:00:00.000Z");
    await planAdd(prevRetained, "2019-05-01T10:00:00.000Z");
    await makeUser("2019-04-24T10:00:00.000Z");

    // --- W4 cohort (week of 8 Apr): 2 users, 1 active in the week of 6 May ---
    const w4Retained = await makeUser("2019-04-09T10:00:00.000Z");
    await planAdd(w4Retained, "2019-05-07T10:00:00.000Z");
    await makeUser("2019-04-10T10:00:00.000Z");

    const samples = await collectRetention({ prisma, now });
    const value = (metric: string) => samples.find((s) => s.metric === metric)?.value;

    assert.equal(value("retention.w1"), 2 / 4, "cohort {retained, sundayLate, sameWeekOnly, noReturn} (ADMIN and next-week signup excluded); 2 retained in week N+1");
    assert.equal(value("retention.w1_n"), 4, "cohort size n is reported");
    assert.equal(value("retention.w1_prev"), 0.5);
    assert.equal(value("retention.w1_prev_n"), 2);
    assert.equal(value("retention.w4"), 0.5);
    assert.equal(value("retention.w4_n"), 2);

    // Empty cohorts: an arbitrary date far from any fixture must yield NO sample, never a fabricated 0/0.
    const emptySamples = await collectRetention({ prisma, now: new Date("2019-09-01T09:00:00.000Z") });
    assert.equal(emptySamples.length, 0, "empty cohorts must write zero samples, not 0/0");

    // Monday-morning invariance: the same cohorts are measured at Mon 13 May 00:10 Minsk and Sun 19 May 23:50 Minsk.
    const mondayNow = await collectRetention({ prisma, now: new Date("2019-05-12T21:10:00.000Z") });
    const sundayNow = await collectRetention({ prisma, now: new Date("2019-05-19T20:50:00.000Z") });
    assert.deepEqual(mondayNow, sundayNow, "cohort samples depend on the ISO week only, not the day");

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

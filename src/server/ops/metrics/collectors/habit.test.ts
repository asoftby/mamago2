/**
 * habit collector test — 3-of-4-week habit with "activated planning
 * families" eligibility (not "everyone ever registered ≥28d ago") and the
 * 7-day-shifted `_prev` comparison.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/habit.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { collectHabit } from "./habit";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const userIds: string[] = [];
const eventIds: string[] = [];
const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeUser(role: "USER" | "ADMIN" = "USER"): Promise<string> {
    const user = await prisma.user.create({
      data: { email: `habit-test-${marker}-${randomUUID()}@example.invalid`, role },
    });
    userIds.push(user.id);
    return user.id;
  }

  async function saveAt(userId: string, now: Date, daysAgo: number) {
    const event = await prisma.userEvent.create({
      data: { userId, eventType: "SAVE", createdAt: new Date(now.getTime() - daysAgo * DAY_MS) },
    });
    eventIds.push(event.id);
  }

  try {
    const now = new Date("2019-07-01T09:00:00.000Z");
    const SEED_DAYS_AGO = 100; // well before both the 28d and 35d eligibility cutoffs

    // Eligible, habitual in the CURRENT window (buckets {0,1,2,3}), active in {0,1,2}.
    const userCurrentHabitual = await makeUser();
    await saveAt(userCurrentHabitual, now, SEED_DAYS_AGO);
    await saveAt(userCurrentHabitual, now, 2); // bucket 0
    await saveAt(userCurrentHabitual, now, 9); // bucket 1
    await saveAt(userCurrentHabitual, now, 16); // bucket 2

    // Eligible, NOT habitual (only 2 of 4 weeks).
    const userCurrentNotHabitual = await makeUser();
    await saveAt(userCurrentNotHabitual, now, SEED_DAYS_AGO);
    await saveAt(userCurrentNotHabitual, now, 2); // bucket 0
    await saveAt(userCurrentNotHabitual, now, 9); // bucket 1

    // Eligible, habitual only in the 7-day-shifted PREV window (buckets
    // {1,2,3,4}), active in {2,3,4} — must NOT count toward the current figure.
    const userPrevOnlyHabitual = await makeUser();
    await saveAt(userPrevOnlyHabitual, now, SEED_DAYS_AGO);
    await saveAt(userPrevOnlyHabitual, now, 16); // bucket 2
    await saveAt(userPrevOnlyHabitual, now, 23); // bucket 3
    await saveAt(userPrevOnlyHabitual, now, 30); // bucket 4

    // NOT eligible: first-ever qualifying action is INSIDE the window
    // (day -20, after both the -28d and -35d cutoffs) even though it
    // reaches 3 active buckets by raw count — must be excluded from both
    // the numerator and denominator (the "graveyard of old registrations"
    // fix: eligibility is about first ACTIVATION, not raw bucket count).
    const userNewNotEligible = await makeUser();
    await saveAt(userNewNotEligible, now, 20); // bucket 2 — also this user's FIRST-EVER action
    await saveAt(userNewNotEligible, now, 10); // bucket 1
    await saveAt(userNewNotEligible, now, 3); // bucket 0

    // Excluded role — must not appear in either eligibility or bucket sets.
    const userAdmin = await makeUser("ADMIN");
    await saveAt(userAdmin, now, SEED_DAYS_AGO);
    await saveAt(userAdmin, now, 2);
    await saveAt(userAdmin, now, 9);
    await saveAt(userAdmin, now, 16);

    const samples = await collectHabit({ prisma, now });
    const current = samples.find((s) => s.metric === "habit.3of4week");
    const prev = samples.find((s) => s.metric === "habit.3of4week_prev");

    assert.ok(current, "habit.3of4week must be written for a non-empty eligible set");
    assert.equal(
      current!.value,
      1 / 3,
      "eligible = {currentHabitual, currentNotHabitual, prevOnlyHabitual} (newNotEligible + admin excluded); only currentHabitual reaches 3-of-4",
    );

    assert.ok(prev, "habit.3of4week_prev must be written");
    assert.equal(prev!.value, 1 / 3, "same eligible set; only prevOnlyHabitual reaches 3-of-4 in the shifted window");

    console.log("habit.test.ts: OK");
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

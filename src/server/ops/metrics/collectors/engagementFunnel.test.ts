/**
 * engagementFunnel collector test — ordered-intersection funnel rates
 * (action at/after the user's first DETAIL_OPEN), not independent
 * all-user rates.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/engagementFunnel.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { collectEngagementFunnel } from "./engagementFunnel";

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
    const user = await prisma.user.create({ data: { email: `funnel-test-${marker}-${randomUUID()}@example.invalid` } });
    userIds.push(user.id);
    return user.id;
  }

  async function makeEvent(userId: string, eventType: "DETAIL_OPEN" | "SAVE" | "PLAN_ADD" | "CTA_CLICK", createdAt: Date) {
    const event = await prisma.userEvent.create({ data: { userId, eventType, createdAt } });
    eventIds.push(event.id);
  }

  try {
    const now = new Date("2019-08-01T09:00:00.000Z");
    const HOUR = 60 * 60 * 1000;

    const userEngagedSaved = await makeUser();
    await makeEvent(userEngagedSaved, "DETAIL_OPEN", new Date(now.getTime() - 5 * HOUR));
    await makeEvent(userEngagedSaved, "SAVE", new Date(now.getTime() - 4 * HOUR)); // after open

    const userEngagedNoAction = await makeUser();
    await makeEvent(userEngagedNoAction, "DETAIL_OPEN", new Date(now.getTime() - 5 * HOUR));

    // Action happened BEFORE this user's first open — must NOT count toward
    // saveRate (the ordering fix that prevents a >100% rate).
    const userActionBeforeOpen = await makeUser();
    await makeEvent(userActionBeforeOpen, "SAVE", new Date(now.getTime() - 6 * HOUR));
    await makeEvent(userActionBeforeOpen, "DETAIL_OPEN", new Date(now.getTime() - 5 * HOUR));

    // No DETAIL_OPEN at all — must not be counted as engaged, must not
    // inflate planRate.
    const userPlanNoOpen = await makeUser();
    await makeEvent(userPlanNoOpen, "PLAN_ADD", new Date(now.getTime() - 5 * HOUR));

    const samples = await collectEngagementFunnel({ prisma, now });
    const engaged = samples.find((s) => s.metric === "funnel.engaged_users");
    const saveRate = samples.find((s) => s.metric === "funnel.save_rate");
    const planRate = samples.find((s) => s.metric === "funnel.plan_rate");
    const ctaRate = samples.find((s) => s.metric === "funnel.cta_rate");

    assert.equal(engaged?.value, 3, "engaged = users with a DETAIL_OPEN in-window; userPlanNoOpen excluded");
    assert.equal(saveRate?.value, 1 / 3, "only userEngagedSaved's SAVE is at/after their first open");
    assert.equal(planRate?.value, 0, "no engaged user has a PLAN_ADD at/after their first open");
    assert.equal(ctaRate?.value, 0, "no engaged user has a CTA_CLICK at/after their first open");

    // engaged === 0 case: rates must be undefined, not a fabricated 0/0.
    const emptySamples = await collectEngagementFunnel({ prisma, now: new Date("2019-11-11T09:00:00.000Z") });
    assert.deepEqual(
      emptySamples,
      [{ metric: "funnel.engaged_users", value: 0 }],
      "with zero engaged users, only engaged_users=0 is written — no rate samples",
    );

    console.log("engagementFunnel.test.ts: OK");
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

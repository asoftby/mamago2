/**
 * Audience collector tests (§21 Step 5, Phase P).
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/ops/metrics/collectors/audience.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { resolvePerformanceWindow } from "@/lib/performance/performanceMetrics";
import { collectAudienceDau } from "./audienceDaily";
import { collectAudienceWeeklyMonthly } from "./audienceWeeklyMonthly";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const createdEventIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeUser(): Promise<string> {
    const user = await prisma.user.create({ data: { email: `audience-test-${marker}-${randomUUID()}@example.invalid` } });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function makeEvent(userId: string, createdAt: Date) {
    const event = await prisma.userEvent.create({
      data: { userId, eventType: "PAGE_VIEW", createdAt },
    });
    createdEventIds.push(event.id);
  }

  try {
    const now = new Date("2026-08-17T12:00:00.000Z");

    const dayWindow = resolvePerformanceWindow("today", now);
    const weekWindow = resolvePerformanceWindow("7d", now);
    const monthWindow = resolvePerformanceWindow("30d", now);

    const userToday = await makeUser();
    const userThisWeekOnly = await makeUser();
    const userThisMonthOnly = await makeUser();
    const userOutsideAll = await makeUser();
    const userNoIdentity = null; // simulate anonymous event (userId omitted)

    // Inside today's window (also inside week/month windows).
    await makeEvent(userToday, new Date(dayWindow.start.getTime() + 60_000));

    // Inside the week window but before today started.
    await makeEvent(userThisWeekOnly, new Date(weekWindow.start.getTime() + 60_000));

    // Inside the month window but before the week window started.
    await makeEvent(userThisMonthOnly, new Date(monthWindow.start.getTime() + 60_000));

    // Well outside every window.
    await makeEvent(userOutsideAll, new Date(monthWindow.start.getTime() - 10 * 24 * 60 * 60 * 1000));

    // Anonymous event (null userId, real sessionId) — under the canonical
    // audience contract this counts as an anonymous-ONLY visitor (it's
    // never linked to any userId in-window), additive to the authenticated
    // count, not excluded. It falls inside all three windows (dayWindow.start
    // is by construction >= weekWindow.start >= monthWindow.start).
    const anonEvent = await prisma.userEvent.create({
      data: { userId: userNoIdentity ?? undefined, sessionId: `anon-${marker}`, eventType: "PAGE_VIEW", createdAt: dayWindow.start },
    });
    createdEventIds.push(anonEvent.id);

    // DAU: userToday (authenticated) + the anonymous session, both inside today's window.
    const dauResult = await collectAudienceDau({ prisma, now });
    assert.equal(dauResult.length, 1);
    assert.equal(dauResult[0].metric, "audience.dau");
    assert.equal(dauResult[0].value, 2, "today's authenticated user + the anonymous-only session must both count toward DAU");

    // WAU/MAU: userToday + userThisWeekOnly + the anonymous session inside the week window;
    // + userThisMonthOnly inside the month window; userOutsideAll never counts.
    const wauMauResult = await collectAudienceWeeklyMonthly({ prisma, now });
    const wau = wauMauResult.find((s) => s.metric === "audience.wau");
    const mau = wauMauResult.find((s) => s.metric === "audience.mau");
    assert.equal(wau?.value, 3, "WAU must include today's and this-week's users plus the anonymous session, not this-month-only");
    assert.equal(mau?.value, 4, "MAU must include all three in-window authenticated users plus the anonymous session");

    // Identity/filter semantics: dimKey stays global ("").
    assert.equal(dauResult[0].dimKey, undefined, "collector emits no dimKey -> collectorRun writes global dimKey=''");

    console.log("audience.test.ts: OK");
  } finally {
    await prisma.userEvent.deleteMany({ where: { id: { in: createdEventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
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

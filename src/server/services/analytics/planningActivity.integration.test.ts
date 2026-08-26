/**
 * planningActivity.ts integration tests.
 * Run: DATABASE_URL=<isolated-db-url> npx tsx src/server/services/analytics/planningActivity.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  countPlanningActiveUsers,
  countUsersWithPlanningActivity,
  getEligiblePlanningFamilies,
  getPlanningActiveUserWeekBuckets,
} from "./planningActivity";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must point at an isolated test database");
}

const marker = randomUUID().slice(0, 8);
const userIds: string[] = [];
const eventIds: string[] = [];
const routeIds: string[] = [];
const routeIdeaIds: string[] = [];
const dayScenarioIds: string[] = [];
const planItemIds: string[] = [];

async function main() {
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

  async function makeUser(role: "USER" | "ADMIN" | "MODERATOR" = "USER"): Promise<string> {
    const user = await prisma.user.create({
      data: { email: `planning-activity-${marker}-${randomUUID()}@example.invalid`, role },
    });
    userIds.push(user.id);
    return user.id;
  }

  async function makeRoute(): Promise<string> {
    const route = await prisma.route.create({
      data: { slug: `planning-activity-${marker}-${randomUUID()}`, title: "Test route", ageTags: [] },
    });
    routeIds.push(route.id);
    return route.id;
  }

  try {
    // A safely inert historical date (long before any real app data could
    // exist in a local dev database) — unlike a near-"now" fixed date, this
    // keeps unrestricted DISTINCT-user counts from picking up real rows.
    const now = new Date("2019-03-04T12:00:00.000Z");
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const end = now;
    const inWindow = new Date(start.getTime() + 60_000);
    const outsideWindow = new Date(start.getTime() - 60_000);

    const routeId = await makeRoute();

    const userSave = await makeUser();
    const savedEvent = await prisma.userEvent.create({
      data: { userId: userSave, eventType: "SAVE", createdAt: inWindow },
    });
    eventIds.push(savedEvent.id);

    const userPlanAdd = await makeUser();
    const planAddEvent = await prisma.userEvent.create({
      data: { userId: userPlanAdd, eventType: "PLAN_ADD", createdAt: inWindow },
    });
    eventIds.push(planAddEvent.id);

    const userRouteIdea = await makeUser();
    const routeIdea = await prisma.routeIdea.create({
      data: { userId: userRouteIdea, routeId, createdAt: inWindow },
    });
    routeIdeaIds.push(routeIdea.id);

    const userScenarioCreated = await makeUser();
    const scenarioCreated = await prisma.dayScenario.create({
      data: { userId: userScenarioCreated, date: "2019-03-04", planFingerprint: "fp", createdAt: inWindow, updatedAt: inWindow },
    });
    dayScenarioIds.push(scenarioCreated.id);

    // Scenario created OUTSIDE the window, then updated INSIDE it — must
    // still count (covers "returned to an existing plan with meaningful
    // interaction").
    const userScenarioUpdated = await makeUser();
    const scenarioUpdated = await prisma.dayScenario.create({
      data: {
        userId: userScenarioUpdated,
        date: "2019-02-25",
        planFingerprint: "fp",
        createdAt: outsideWindow,
      },
    });
    dayScenarioIds.push(scenarioUpdated.id);
    await prisma.dayScenario.update({ where: { id: scenarioUpdated.id }, data: { updatedAt: inWindow } });

    const userPlanItemRoute = await makeUser();
    const planItem = await prisma.planItem.create({
      data: { userId: userPlanItemRoute, routeId, date: "2019-03-04", createdAt: inWindow },
    });
    planItemIds.push(planItem.id);

    // Excluded role — must NOT count even though the action is in-window.
    const userAdmin = await makeUser("ADMIN");
    const adminEvent = await prisma.userEvent.create({
      data: { userId: userAdmin, eventType: "SAVE", createdAt: inWindow },
    });
    eventIds.push(adminEvent.id);

    // In-window but wrong action type — a PLAN_ADD from an admin plus a
    // regular user's PAGE_VIEW must not leak into the count.
    const userPageViewOnly = await makeUser();
    const pageViewEvent = await prisma.userEvent.create({
      data: { userId: userPageViewOnly, eventType: "PAGE_VIEW", createdAt: inWindow },
    });
    eventIds.push(pageViewEvent.id);

    // Outside the window — must not count.
    const userOutside = await makeUser();
    const outsideEvent = await prisma.userEvent.create({
      data: { userId: userOutside, eventType: "SAVE", createdAt: outsideWindow },
    });
    eventIds.push(outsideEvent.id);

    const activeCount = await countPlanningActiveUsers(prisma, start, end);
    assert.equal(
      activeCount,
      6,
      "SAVE + PLAN_ADD + RouteIdea + DayScenario-created + DayScenario-updated + PlanItem(route) must each count once, ADMIN/PAGE_VIEW/outside-window excluded",
    );

    // countUsersWithPlanningActivity — restrict to a specific candidate set.
    const restricted = await countUsersWithPlanningActivity(prisma, [userSave, userOutside, userPageViewOnly], start, end);
    assert.equal(restricted, 1, "only userSave from the candidate set is active in-window");
    assert.equal(await countUsersWithPlanningActivity(prisma, [], start, end), 0, "empty candidate list must short-circuit to 0");

    // getEligiblePlanningFamilies — first-ever qualifying action (createdAt
    // only) strictly before a cutoff.
    const eligibleBeforeNow = await getEligiblePlanningFamilies(prisma, now);
    assert.ok(eligibleBeforeNow.has(userSave), "userSave's action predates `now`");
    assert.ok(!eligibleBeforeNow.has(userAdmin), "ADMIN must be excluded from eligibility");
    // userScenarioUpdated's DayScenario was CREATED outside the window (before
    // `start`), so it must be eligible using a cutoff of `start` even though
    // its most recent activity (the update) is inside the window.
    const eligibleBeforeStart = await getEligiblePlanningFamilies(prisma, start);
    assert.ok(
      eligibleBeforeStart.has(userScenarioUpdated),
      "eligibility must use createdAt (first action), not updatedAt",
    );
    assert.ok(!eligibleBeforeStart.has(userSave), "userSave's only action is inside [start, end), not before start");

    // getPlanningActiveUserWeekBuckets — per-user weekly bucket membership
    // over a 5-week trailing span ending `now`.
    const userBucket0 = await makeUser();
    const bucket0Event = await prisma.userEvent.create({
      data: { userId: userBucket0, eventType: "SAVE", createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
    });
    eventIds.push(bucket0Event.id);

    const userBucket3 = await makeUser();
    const bucket3Event = await prisma.userEvent.create({
      data: { userId: userBucket3, eventType: "SAVE", createdAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000) },
    });
    eventIds.push(bucket3Event.id);

    const userBucket4 = await makeUser();
    const bucket4Event = await prisma.userEvent.create({
      data: { userId: userBucket4, eventType: "SAVE", createdAt: new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000) },
    });
    eventIds.push(bucket4Event.id);

    const userBeyondSpan = await makeUser();
    const beyondSpanEvent = await prisma.userEvent.create({
      data: { userId: userBeyondSpan, eventType: "SAVE", createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000) },
    });
    eventIds.push(beyondSpanEvent.id);

    const buckets = await getPlanningActiveUserWeekBuckets(prisma, now, 5);
    assert.ok(buckets.get(userBucket0)?.has(0), "1 day ago falls in bucket 0");
    assert.ok(buckets.get(userBucket3)?.has(3), "25 days ago falls in bucket 3");
    assert.ok(buckets.get(userBucket4)?.has(4), "32 days ago falls in bucket 4");
    assert.ok(!buckets.has(userBeyondSpan), "activity older than the 5-week (35-day) span must not appear");

    console.log("planningActivity.integration.test.ts: OK");
  } finally {
    await prisma.planItem.deleteMany({ where: { id: { in: planItemIds } } });
    await prisma.dayScenarioItemOverride.deleteMany({ where: { scenarioId: { in: dayScenarioIds } } });
    await prisma.dayScenario.deleteMany({ where: { id: { in: dayScenarioIds } } });
    await prisma.routeIdea.deleteMany({ where: { id: { in: routeIdeaIds } } });
    await prisma.userEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.route.deleteMany({ where: { id: { in: routeIds } } });
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

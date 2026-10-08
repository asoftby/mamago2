/**
 * Family Core M4a: share / make-private rule. Disposable local DB only:
 *   FAMILY_CORE_READS=1 NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";

process.env.FAMILY_CORE_READS = "1";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at a disposable test database");
if (!["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Plan visibility integration tests refuse non-local databases");
}

const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const userIds: string[] = [];
const familyIds: string[] = [];

after(async () => {
  await db.userEvent.deleteMany({ where: { sessionId: { startsWith: `m4-${run}` } } });
  await db.userEvent.deleteMany({ where: { userId: { in: userIds } } });
  await db.experience.deleteMany({ where: { userId: { in: userIds } } });
  await db.planItem.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.family.deleteMany({ where: { id: { in: familyIds } } });
  await db.$disconnect();
});

async function mkFamily() {
  const mk = async (label: string) => {
    const id = `m4-${run}-${label}`;
    await db.user.create({ data: { id, email: `${id}@example.test`, displayName: label } });
    userIds.push(id);
    return id;
  };
  const a = await mk(`a${userIds.length}`);
  const b = await mk(`b${userIds.length}`);
  const family = await db.family.create({ data: {} });
  familyIds.push(family.id);
  await db.familyMembership.create({ data: { familyId: family.id, userId: a, role: "OWNER" } });
  await db.familyMembership.create({ data: { familyId: family.id, userId: b, role: "ADULT" } });
  return { a, b, familyId: family.id };
}

const codeOf = async (p: Promise<unknown>, E: new (...a: never[]) => Error & { code: string }) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof E ? e.code : `other:${String(e)}`;
  }
};

test("share, then make private; other adult's action blocks the return", async () => {
  const { sharePlanItemWithFamily, makePlanItemPrivate, PlanVisibilityError } = await import("./planVisibility.service");
  const { a, b, familyId } = await mkFamily();
  const item = await db.planItem.create({
    data: { userId: a, familyId, visibility: "PRIVATE", date: "2026-12-05", title: "t" },
  });

  // The other adult cannot even see a PRIVATE item.
  assert.equal(await codeOf(sharePlanItemWithFamily({ userId: b, planItemId: item.id }), PlanVisibilityError as never), "not_found");

  const shared = await sharePlanItemWithFamily({ userId: a, planItemId: item.id });
  assert.equal(shared.visibility, "FAMILY");
  assert.equal(await db.userEvent.count({ where: { userId: a, eventType: "PLAN_ITEM_SHARED", familyId } }), 1);

  // Stale client version => conflict.
  assert.equal(
    await codeOf(makePlanItemPrivate({ userId: a, planItemId: item.id, expectedUpdatedAt: new Date(0) }), PlanVisibilityError as never),
    "conflict",
  );
  // Non-author cannot make it private.
  assert.equal(await codeOf(makePlanItemPrivate({ userId: b, planItemId: item.id }), PlanVisibilityError as never), "not_author");

  // The other adult reschedules => blocked.
  await db.userEvent.create({ data: { userId: b, familyId, eventType: "PLAN_ITEM_RESCHEDULED", planVisibility: "FAMILY", meta: { planItemId: item.id } } });
  assert.equal(await codeOf(makePlanItemPrivate({ userId: a, planItemId: item.id }), PlanVisibilityError as never), "other_adult_acted");
});

test("viewing-like activity does not block; make-private works and hides the item from the other adult", async () => {
  const { makePlanItemPrivate } = await import("./planVisibility.service");
  const { a, b, familyId } = await mkFamily();
  const item = await db.planItem.create({ data: { userId: a, familyId, visibility: "FAMILY", date: "2026-12-06", title: "t2" } });
  await db.userEvent.create({ data: { userId: b, familyId, eventType: "PAGE_VIEW", meta: { planItemId: item.id } } });
  const res = await makePlanItemPrivate({ userId: a, planItemId: item.id });
  assert.equal(res.visibility, "PRIVATE");
  const { planScopeFor } = await import("./familyAccess");
  assert.equal(await db.planItem.count({ where: { id: item.id, ...(await planScopeFor(b)) } }), 0);
  assert.equal(await db.planItem.count({ where: { id: item.id, ...(await planScopeFor(a)) } }), 1);
});

test("an outcome recorded by the other adult blocks make-private", async () => {
  const { makePlanItemPrivate, PlanVisibilityError } = await import("./planVisibility.service");
  const { a, b, familyId } = await mkFamily();
  const act = await db.activity.findFirst({ select: { id: true } });
  if (!act) return; // needs at least one Activity row (seeded DBs have them)
  const item = await db.planItem.create({ data: { userId: a, familyId, visibility: "FAMILY", date: "2026-09-01", title: "t3", activityId: act.id } });
  await db.experience.create({
    data: { userId: b, sourcePlanItemId: item.id, entityType: "EVENT", entityId: act.id, plannedDate: "2026-09-01", attendance: "ATTENDED", attendanceConfirmedAt: new Date() },
  });
  assert.equal(await codeOf(makePlanItemPrivate({ userId: a, planItemId: item.id }), PlanVisibilityError as never), "other_adult_acted");
});

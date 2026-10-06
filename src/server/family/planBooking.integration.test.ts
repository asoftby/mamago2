/**
 * Family Core M6: booking ↔ plan item link and the safe state for other adults.
 * Disposable local DB only:
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";

process.env.FAMILY_CORE_READS = "1";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at a disposable test database");
if (!["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Plan booking integration tests refuse non-local databases");
}

const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const userIds: string[] = [];
const familyIds: string[] = [];
let businessId = "";

after(async () => {
  await db.bookingRequest.deleteMany({ where: { businessId } });
  await db.planItem.deleteMany({ where: { userId: { in: userIds } } });
  await db.business.deleteMany({ where: { id: businessId } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.family.deleteMany({ where: { id: { in: familyIds } } });
  await db.$disconnect();
});

async function mkUser(label: string) {
  const id = `m6-${run}-${label}`;
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: label } });
  userIds.push(id);
  return id;
}

async function mkFamily() {
  const a = await mkUser(`a${userIds.length}`);
  const b = await mkUser(`b${userIds.length}`);
  const family = await db.family.create({ data: {} });
  familyIds.push(family.id);
  await db.familyMembership.create({ data: { familyId: family.id, userId: a, role: "OWNER" } });
  await db.familyMembership.create({ data: { familyId: family.id, userId: b, role: "ADULT" } });
  return { a, b, familyId: family.id };
}

async function ensureBusiness() {
  if (businessId) return businessId;
  const owner = await mkUser("biz");
  businessId = (await db.business.create({ data: { ownerUserId: owner, name: `m6-${run}` } })).id;
  return businessId;
}

async function mkBooking(userId: string, planItemId: string | null, status: "NEW" | "CONFIRMED" = "NEW") {
  return db.bookingRequest.create({
    data: {
      businessId: await ensureBusiness(),
      userId,
      planItemId,
      publicationType: "EVENT",
      customerName: "SECRET NAME",
      customerPhone: "+375291112233",
      customerComment: "SECRET COMMENT",
      requestedTime: "12:00",
      status,
    },
  });
}

test("other adult sees a safe state of a FAMILY item's booking, never contacts", async () => {
  const { getPlanBookingStates } = await import("./planBooking.service");
  const { a, b, familyId } = await mkFamily();
  const item = await db.planItem.create({ data: { userId: a, familyId, visibility: "FAMILY", date: "2026-12-05", title: "t" } });
  await mkBooking(a, item.id, "CONFIRMED");

  const mine = (await getPlanBookingStates(a, [item.id])).get(item.id);
  assert.equal(mine?.isMine, true);
  assert.equal(mine?.status, "CONFIRMED");

  const theirs = (await getPlanBookingStates(b, [item.id])).get(item.id);
  assert.equal(theirs?.isMine, false);
  assert.equal(theirs?.requestedTime, "12:00");
  assert.ok(theirs?.bookedByName, "shows who booked");
  const serialized = JSON.stringify(theirs);
  assert.ok(!serialized.includes("SECRET") && !serialized.includes("375291112233"), "no contacts leak");
});

test("PRIVATE item's booking is invisible to the other adult", async () => {
  const { getPlanBookingStates } = await import("./planBooking.service");
  const { a, b, familyId } = await mkFamily();
  const item = await db.planItem.create({ data: { userId: a, familyId, visibility: "PRIVATE", date: "2026-12-06", title: "p" } });
  await mkBooking(a, item.id);
  assert.equal((await getPlanBookingStates(b, [item.id])).size, 0);
  assert.equal((await getPlanBookingStates(a, [item.id])).size, 1);
});

test("explicit link must be visible to the booker; auto-link only when unambiguous", async () => {
  const { resolveBookingPlanItem } = await import("./planBooking.service");
  const { a, b, familyId } = await mkFamily();
  const priv = await db.planItem.create({ data: { userId: a, familyId, visibility: "PRIVATE", date: "2026-12-07", title: "p" } });
  const shared = await db.planItem.create({ data: { userId: a, familyId, visibility: "FAMILY", date: "2026-12-08", title: "s" } });

  const base = { publicationType: "EVENT", publicationId: "x", requestedDate: null };
  assert.equal((await resolveBookingPlanItem({ ...base, userId: b, planItemId: priv.id })).invalid, true, "other adult cannot link a PRIVATE item");
  assert.equal((await resolveBookingPlanItem({ ...base, userId: b, planItemId: shared.id })).planItemId, shared.id);
  assert.equal((await resolveBookingPlanItem({ ...base, userId: null, planItemId: shared.id })).invalid, true, "guest cannot link");

  const act = await db.activity.findFirst({ select: { id: true } });
  if (act) {
    const one = await db.planItem.create({ data: { userId: a, familyId, visibility: "FAMILY", date: "2026-12-09", title: "o", activityId: act.id } });
    const res = await resolveBookingPlanItem({ ...base, publicationId: act.id, userId: b, requestedDate: null });
    // Exactly one open candidate for this activity (if the fixture DB has no other plan of this family).
    assert.equal(res.planItemId, one.id);
    await mkBooking(a, one.id);
    assert.equal((await resolveBookingPlanItem({ ...base, publicationId: act.id, userId: b })).planItemId, null, "already booked");
  }
});

/**
 * Family Core A2: family events always persist the actor's active familyId, and
 * the read-only NOT NULL preflight SQL runs and reports seeded violations.
 *
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>   (disposable local DB)
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { trackUserEvent } from "@/server/services/analytics/AnalyticsEventService";
import { recordPlanAudienceSnapshot } from "@/lib/decision/subjects";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at a disposable test database");
if (!["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Family Core A2 integration tests refuse non-local databases");
}

const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const sid = `a2-${run}`;
const userIds: string[] = [];
const familyIds: string[] = [];

after(async () => {
  await db.userEvent.deleteMany({ where: { sessionId: { startsWith: sid } } });
  await db.planItem.deleteMany({ where: { userId: { in: userIds } } });
  await db.child.deleteMany({ where: { parentId: { in: userIds } } });
  await db.family.deleteMany({ where: { id: { in: familyIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

async function mkUser(label: string, deleted = false) {
  const id = `${sid}-${label}`;
  await db.user.create({
    data: { id, email: `${id}@example.test`, deletedAt: deleted ? new Date() : null },
  });
  userIds.push(id);
  return id;
}

test("family events carry the active familyId; others and family-less users do not; no family is created", async () => {
  const u = await mkUser("member");
  const loner = await mkUser("loner");
  const fam = await db.family.create({ data: {} });
  familyIds.push(fam.id);
  await db.familyMembership.create({ data: { familyId: fam.id, userId: u, role: "OWNER" } });
  const familiesBefore = await db.family.count();

  await trackUserEvent({ eventType: "PLAN_ADD", userId: u, sessionId: `${sid}-1` });
  await trackUserEvent({ eventType: "ATTENDED", userId: u, sessionId: `${sid}-6` });
  await trackUserEvent({ eventType: "PAGE_VIEW", userId: u, sessionId: `${sid}-2` });
  await trackUserEvent({ eventType: "PLAN_ADD", userId: u, familyId: null, sessionId: `${sid}-3` });
  await trackUserEvent({ eventType: "PLAN_ADD", userId: loner, sessionId: `${sid}-4` });
  await recordPlanAudienceSnapshot({
    userId: u, sessionId: `${sid}-5`, entityType: "EVENT", entityId: "e1", planItemId: "p1", date: "2026-10-10", subjects: [],
  });

  const fid = async (n: number) =>
    (await db.userEvent.findFirstOrThrow({ where: { sessionId: `${sid}-${n}` } })).familyId;
  assert.equal(await fid(1), fam.id);
  assert.equal(await fid(2), null);
  assert.equal(await fid(3), null);
  assert.equal(await fid(4), null);
  assert.equal(await fid(5), fam.id);
  assert.equal(await fid(6), fam.id);
  assert.equal(await db.family.count(), familiesBefore);
});

test("NOT NULL preflight SQL is read-only and flags live null-family rows", async () => {
  const live = await mkUser("pf-live");
  const dead = await mkUser("pf-dead", true);
  await db.child.create({ data: { parentId: live, name: "pf" } });
  await db.planItem.create({ data: { userId: dead, date: "2026-10-10", title: "pf" } });

  const sql = readFileSync("scripts/sql/family-core-not-null-preflight.sql", "utf8");
  const before = await db.child.count();
  const rows = await db.$queryRawUnsafe<Array<{ check_name: string; kind: string; n: bigint }>>(sql);
  const n = (c: string) => Number(rows.find((r) => r.check_name === c)!.n);
  assert.equal(await db.child.count(), before);
  assert.ok(n("child_null_family_live_user") >= 1);
  assert.ok(n("planitem_null_family_tombstone_user") >= 1);
  assert.ok(n("live_user_without_active_membership_but_with_data") >= 1);
  assert.equal(n("planitem_private_proposed_violation"), 0);
});

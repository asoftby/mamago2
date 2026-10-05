/**
 * Family Core B3: deleteAccount is family-aware (independent of FAMILY_CORE_READS).
 *
 * Run against a disposable local DB with the react-server condition (server-only):
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { deleteAccount } from "./deleteAccount.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at a disposable test database");
const parsed = new URL(databaseUrl);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("Family Core B3 integration tests refuse non-local databases");
}

const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const userIds: string[] = [];
const familyIds: string[] = [];

after(async () => {
  await db.userEvent.deleteMany({ where: { sessionId: { startsWith: `b3-${run}` } } });
  await db.experience.deleteMany({ where: { userId: { in: userIds } } });
  await db.planItem.deleteMany({ where: { userId: { in: userIds } } });
  await db.child.deleteMany({ where: { parentId: { in: userIds } } });
  await db.family.deleteMany({ where: { id: { in: familyIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

async function mkUser(label: string): Promise<string> {
  const id = `b3-${run}-${label}`;
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: label } });
  userIds.push(id);
  return id;
}

async function mkFamily(members: Array<{ userId: string; role: "OWNER" | "ADULT"; joinedAt: Date }>) {
  const family = await db.family.create({ data: {} });
  familyIds.push(family.id);
  for (const m of members) await db.familyMembership.create({ data: { familyId: family.id, ...m } });
  return family.id;
}

const t = (n: number) => new Date(Date.UTC(2026, 0, n));

async function seed(userId: string, familyId: string | null, label: string) {
  const child = await db.child.create({
    data: { parentId: userId, familyId, createdById: userId, name: `${label}-child` },
  });
  const shared = await db.planItem.create({
    data: { userId, familyId, visibility: "FAMILY", date: "2026-10-10", title: `${label}-shared` },
  });
  const priv = await db.planItem.create({
    data: { userId, familyId, visibility: "PRIVATE", date: "2026-10-11", title: `${label}-private` },
  });
  return { child, shared, priv };
}

async function mkExperience(userId: string, planItemId: string) {
  return db.experience.create({
    data: {
      userId,
      sourcePlanItemId: planItemId,
      entityType: "EVENT",
      entityId: `e-${planItemId}`,
      plannedDate: "2026-10-10",
      attendance: "ATTENDED",
      attendanceConfirmedAt: new Date(),
    },
  });
}

const active = (userId: string) => db.familyMembership.findMany({ where: { userId, leftAt: null } });

test("solo OWNER: membership closed, family archived, family data and experience erased", async () => {
  const u = await mkUser("solo");
  const familyId = await mkFamily([{ userId: u, role: "OWNER", joinedAt: t(1) }]);
  const { child, shared } = await seed(u, familyId, "solo");
  await db.childCustomInterest.create({ data: { childId: child.id, label: "x" } }).catch(() => undefined);
  await mkExperience(u, shared.id);

  assert.deepEqual(await deleteAccount(u, db), { ok: true });

  assert.equal((await active(u)).length, 0);
  const closed = await db.familyMembership.findFirstOrThrow({ where: { userId: u } });
  assert.ok(closed.leftAt, "historical membership is kept and closed");
  const fam = await db.family.findUniqueOrThrow({ where: { id: familyId } });
  assert.ok(fam.archivedAt);
  assert.equal(fam.archivedAt!.getTime(), closed.leftAt!.getTime());
  assert.equal(await db.child.count({ where: { familyId } }), 0);
  assert.equal(await db.planItem.count({ where: { familyId } }), 0);
  assert.equal(await db.experience.count({ where: { userId: u } }), 0);
  assert.ok((await db.user.findUniqueOrThrow({ where: { id: u } })).deletedAt);
});

test("OWNER + second ADULT: ownership moves deterministically, shared data survives", async () => {
  const owner = await mkUser("own2");
  const early = await mkUser("early");
  const late = await mkUser("late");
  const familyId = await mkFamily([
    { userId: owner, role: "OWNER", joinedAt: t(1) },
    { userId: late, role: "ADULT", joinedAt: t(5) },
    { userId: early, role: "ADULT", joinedAt: t(3) },
  ]);
  const o = await seed(owner, familyId, "own2");
  const e = await seed(early, familyId, "early");
  await mkExperience(early, e.shared.id);

  assert.deepEqual(await deleteAccount(owner, db), { ok: true });

  assert.equal((await active(owner)).length, 0);
  const members = await db.familyMembership.findMany({ where: { familyId, leftAt: null } });
  const owners = members.filter((m) => m.role === "OWNER");
  assert.equal(owners.length, 1);
  assert.equal(owners[0].userId, early, "earliest joinedAt becomes OWNER");
  assert.equal(members.find((m) => m.userId === late)!.role, "ADULT");
  assert.equal((await db.family.findUniqueOrThrow({ where: { id: familyId } })).archivedAt, null);

  const kid = await db.child.findUniqueOrThrow({ where: { id: o.child.id } });
  assert.equal(kid.familyId, familyId);
  assert.equal(kid.parentId, owner, "parentId stays as tombstone provenance");
  assert.equal(kid.createdById, null);
  assert.equal(await db.planItem.count({ where: { id: o.shared.id } }), 1);
  assert.equal((await db.planItem.findUniqueOrThrow({ where: { id: o.shared.id } })).userId, owner);
  assert.equal(await db.planItem.count({ where: { id: o.priv.id } }), 0);

  // other adult untouched
  assert.equal((await db.child.findUniqueOrThrow({ where: { id: e.child.id } })).createdById, early);
  assert.equal(await db.planItem.count({ where: { id: { in: [e.shared.id, e.priv.id] } } }), 2);
  assert.equal(await db.experience.count({ where: { userId: early } }), 1);
});

test("ADULT leaves while OWNER lives: owner unchanged, FAMILY data kept, PRIVATE erased", async () => {
  const owner = await mkUser("own3");
  const adult = await mkUser("adult3");
  const familyId = await mkFamily([
    { userId: owner, role: "OWNER", joinedAt: t(1) },
    { userId: adult, role: "ADULT", joinedAt: t(2) },
  ]);
  const o = await seed(owner, familyId, "own3");
  const a = await seed(adult, familyId, "adult3");

  assert.deepEqual(await deleteAccount(adult, db), { ok: true });

  assert.equal((await active(adult)).length, 0);
  const own = await db.familyMembership.findFirstOrThrow({ where: { userId: owner, leftAt: null } });
  assert.equal(own.role, "OWNER");
  assert.equal((await db.family.findUniqueOrThrow({ where: { id: familyId } })).archivedAt, null);
  assert.equal(await db.child.count({ where: { id: { in: [o.child.id, a.child.id] } } }), 2);
  assert.equal(await db.planItem.count({ where: { id: { in: [o.shared.id, o.priv.id, a.shared.id] } } }), 3);
  assert.equal(await db.planItem.count({ where: { id: a.priv.id } }), 0);
});

test("legacy user without membership keeps the old behaviour and creates no family", async () => {
  const u = await mkUser("legacy");
  const { child, shared, priv } = await seed(u, null, "legacy");
  const familiesBefore = await db.family.count();

  assert.deepEqual(await deleteAccount(u, db), { ok: true });

  assert.equal(await db.child.count({ where: { id: child.id } }), 0);
  assert.equal(await db.planItem.count({ where: { id: { in: [shared.id, priv.id] } } }), 0);
  assert.equal(await db.familyMembership.count({ where: { userId: u } }), 0);
  assert.equal(await db.family.count(), familiesBefore);
});

test("UserEvent is detached from user, session and family", async () => {
  const u = await mkUser("evt");
  const familyId = await mkFamily([{ userId: u, role: "OWNER", joinedAt: t(1) }]);
  const ev = await db.userEvent.create({
    data: { eventType: "PAGE_VIEW", userId: u, sessionId: `b3-${run}-s`, familyId },
  });

  assert.deepEqual(await deleteAccount(u, db), { ok: true });

  const after = await db.userEvent.findUniqueOrThrow({ where: { id: ev.id } });
  assert.equal(after.userId, null);
  assert.equal(after.sessionId, null);
  assert.equal(after.familyId, null);
});

test("failure rolls back membership, ownership and family archive", async () => {
  const owner = await mkUser("rb-own");
  const adult = await mkUser("rb-adult");
  const familyId = await mkFamily([
    { userId: owner, role: "OWNER", joinedAt: t(1) },
    { userId: adult, role: "ADULT", joinedAt: t(2) },
  ]);
  const solo = await mkUser("rb-solo");
  const soloFamily = await mkFamily([{ userId: solo, role: "OWNER", joinedAt: t(1) }]);
  const s = await seed(solo, soloFamily, "rb");
  const collide = (id: string) =>
    db.user.create({
      data: {
        email: `deleted-${createHash("sha256").update(`mamago-deleted-user:${id}`).digest("hex")}@deleted.invalid`,
      },
    });
  const blockers = [await collide(owner), await collide(solo)];

  await assert.rejects(deleteAccount(owner, db));
  await assert.rejects(deleteAccount(solo, db));

  const members = await db.familyMembership.findMany({ where: { familyId } });
  assert.ok(members.every((m) => m.leftAt === null));
  assert.equal(members.find((m) => m.userId === owner)!.role, "OWNER");
  assert.equal(members.find((m) => m.userId === adult)!.role, "ADULT");
  assert.equal((await db.family.findUniqueOrThrow({ where: { id: familyId } })).archivedAt, null);
  const sf = await db.family.findUniqueOrThrow({ where: { id: soloFamily } });
  assert.equal(sf.archivedAt, null);
  assert.equal((await active(solo)).length, 1);
  assert.equal(await db.child.count({ where: { id: s.child.id } }), 1);
  assert.equal(await db.planItem.count({ where: { id: { in: [s.shared.id, s.priv.id] } } }), 2);

  await db.user.deleteMany({ where: { id: { in: blockers.map((b) => b.id) } } });
});

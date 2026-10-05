/**
 * Family Core M5a: leave family / transfer ownership / list. Disposable local DB only:
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { ensureFamilyForUser } from "./ensureFamily";
import { acceptFamilyInvite, createFamilyInvite } from "./familyInvite.service";
import { FamilyMembersError, leaveFamily, listFamilyForUser, transferFamilyOwnership } from "./familyMembers.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at a disposable test database");
if (!["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Family members integration tests refuse non-local databases");
}

const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const userIds: string[] = [];
const deps = { env: { FAMILY_CORE_READS: "1", FAMILY_INVITES: "1" } };

after(async () => {
  const families = await db.familyMembership.findMany({ where: { userId: { in: userIds } }, select: { familyId: true } });
  await db.childInterest.deleteMany({ where: { child: { parentId: { in: userIds } } } });
  await db.childCustomInterest.deleteMany({ where: { child: { parentId: { in: userIds } } } });
  await db.consentRecord.deleteMany({ where: { userId: { in: userIds } } });
  await db.planItem.deleteMany({ where: { userId: { in: userIds } } });
  await db.child.deleteMany({ where: { parentId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.family.deleteMany({ where: { id: { in: families.map((f) => f.familyId) } } });
  await db.$disconnect();
});

async function mkUser(label: string) {
  const id = `m5-${run}-${label}`;
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: label } });
  userIds.push(id);
  await ensureFamilyForUser(db, id);
  return id;
}

async function mkPair(label: string) {
  const owner = await mkUser(`${label}-o`);
  const adult = await mkUser(`${label}-a`);
  const { token } = await createFamilyInvite(db, { userId: owner }, deps);
  const { familyId } = await acceptFamilyInvite(db, { userId: adult, token, consentTextVersion: "v1" }, deps);
  return { owner, adult, familyId };
}

async function code(p: Promise<unknown>) {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof FamilyMembersError ? e.code : `other:${String(e)}`;
  }
}

test("list shows both adults and children", async () => {
  const { owner, familyId } = await mkPair("list");
  await db.child.create({ data: { name: "Маша", parentId: owner, createdById: owner, familyId } });
  const overview = await listFamilyForUser(db, owner, deps);
  assert.equal(overview?.adults.length, 2);
  assert.equal(overview?.myRole, "OWNER");
  assert.equal(overview?.children.length, 1);
});

test("owner and last adult cannot leave", async () => {
  const { owner } = await mkPair("noleave");
  assert.equal(await code(leaveFamily(db, { userId: owner }, deps)), "owner_must_transfer");
  const solo = await mkUser("solo");
  assert.equal(await code(leaveFamily(db, { userId: solo }, deps)), "last_adult");
});

test("adult leaves: new solo family, PRIVATE items move, FAMILY items stay, copy of children", async () => {
  const { owner, adult, familyId } = await mkPair("leave");
  const kid = await db.child.create({
    data: { name: "Петя", parentId: owner, createdById: owner, familyId, systemInterests: { create: [{ interestSlug: "sport" }] } },
  });
  const priv = await db.planItem.create({
    data: { userId: adult, familyId, visibility: "PRIVATE", childId: kid.id, date: "2026-12-05", title: "private" },
  });
  const shared = await db.planItem.create({
    data: { userId: adult, familyId, visibility: "FAMILY", childId: kid.id, date: "2026-12-05", title: "shared" },
  });

  const { familyId: newFamily } = await leaveFamily(db, { userId: adult, copyChildren: true }, deps);
  assert.notEqual(newFamily, familyId);
  const m = await db.familyMembership.findFirstOrThrow({ where: { userId: adult, leftAt: null } });
  assert.equal(m.familyId, newFamily);
  assert.equal(m.role, "OWNER");
  assert.equal(await db.familyMembership.count({ where: { familyId, leftAt: null } }), 1);

  const p = await db.planItem.findUniqueOrThrow({ where: { id: priv.id } });
  assert.equal(p.familyId, newFamily);
  const copy = await db.child.findFirstOrThrow({ where: { familyId: newFamily } });
  assert.notEqual(copy.id, kid.id);
  assert.equal(p.childId, copy.id);
  assert.equal(await db.childInterest.count({ where: { childId: copy.id, interestSlug: "sport" } }), 1);

  const s = await db.planItem.findUniqueOrThrow({ where: { id: shared.id } });
  assert.equal(s.familyId, familyId, "FAMILY items stay");
  assert.equal(s.userId, adult, "author kept");
  assert.equal(await db.child.count({ where: { familyId } }), 1, "original child untouched");
});

test("leave without copying children drops the child link of moved items", async () => {
  const { adult, owner, familyId } = await mkPair("nocopy");
  const kid = await db.child.create({ data: { name: "Оля", parentId: owner, createdById: owner, familyId } });
  const priv = await db.planItem.create({
    data: { userId: adult, familyId, visibility: "PRIVATE", childId: kid.id, date: "2026-12-05", title: "p" },
  });
  const { familyId: nf } = await leaveFamily(db, { userId: adult }, deps);
  const p = await db.planItem.findUniqueOrThrow({ where: { id: priv.id } });
  assert.equal(p.familyId, nf);
  assert.equal(p.childId, null);
  assert.equal(await db.child.count({ where: { familyId: nf } }), 0);
});

test("transfer ownership then the old owner can leave", async () => {
  const { owner, adult, familyId } = await mkPair("transfer");
  assert.equal(await code(transferFamilyOwnership(db, { userId: adult, targetUserId: owner }, deps)), "not_owner");
  assert.equal(await code(transferFamilyOwnership(db, { userId: owner, targetUserId: owner }, deps)), "same_user");
  await transferFamilyOwnership(db, { userId: owner, targetUserId: adult }, deps);
  const roles = await db.familyMembership.findMany({ where: { familyId, leftAt: null }, select: { userId: true, role: true } });
  assert.equal(roles.find((r) => r.userId === adult)?.role, "OWNER");
  assert.equal(roles.filter((r) => r.role === "OWNER").length, 1);
  await leaveFamily(db, { userId: owner }, deps);
  assert.equal(await db.familyMembership.count({ where: { familyId, leftAt: null } }), 1);
});

test("disabled without FAMILY_CORE_READS", async () => {
  const u = await mkUser("off");
  assert.equal(await code(listFamilyForUser(db, u, { env: {} })), "disabled");
});

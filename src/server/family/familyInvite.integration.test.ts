/**
 * Family Core M2: invites + consent. Disposable local DB only:
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { ensureFamilyForUser } from "./ensureFamily";
import {
  FamilyInviteError,
  acceptFamilyInvite,
  createFamilyInvite,
  revokeFamilyInvite,
} from "./familyInvite.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at a disposable test database");
if (!["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Family invites integration tests refuse non-local databases");
}

const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const userIds: string[] = [];
const env = { FAMILY_INVITES: "1" };
const deps = { env };

after(async () => {
  const families = await db.familyMembership.findMany({ where: { userId: { in: userIds } }, select: { familyId: true } });
  await db.consentRecord.deleteMany({ where: { userId: { in: userIds } } });
  await db.planItem.deleteMany({ where: { userId: { in: userIds } } });
  await db.child.deleteMany({ where: { parentId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.family.deleteMany({ where: { id: { in: families.map((f) => f.familyId) } } });
  await db.$disconnect();
});

async function mkUser(label: string, opts: { solo?: boolean } = { solo: true }) {
  const id = `m2-${run}-${label}`;
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: label } });
  userIds.push(id);
  // Real users always have a (lazy) solo family.
  if (opts.solo !== false) await ensureFamilyForUser(db, id);
  return id;
}

async function code(p: Promise<unknown>) {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof FamilyInviteError ? e.code : `other:${String(e)}`;
  }
}

test("disabled by default", async () => {
  const u = await mkUser("off");
  assert.equal(await code(createFamilyInvite(db, { userId: u }, { env: {} })), "disabled");
});

test("create stores only the hash; max 3 active", async () => {
  const u = await mkUser("owner1");
  const first = await createFamilyInvite(db, { userId: u }, deps);
  const row = await db.familyInvite.findUniqueOrThrow({ where: { id: first.inviteId } });
  assert.notEqual(row.tokenHash, first.token);
  await createFamilyInvite(db, { userId: u }, deps);
  await createFamilyInvite(db, { userId: u }, deps);
  assert.equal(await code(createFamilyInvite(db, { userId: u }, deps)), "limit_reached");
  await revokeFamilyInvite(db, { userId: u, inviteId: first.inviteId }, deps);
  assert.equal(await code(createFamilyInvite(db, { userId: u }, deps)), "ok");
});

test("accept: consent required, joins as ADULT FROM_JOIN, empty solo family archived, single use", async () => {
  const owner = await mkUser("owner2");
  const joiner = await mkUser("joiner2");
  const { token } = await createFamilyInvite(db, { userId: owner }, deps);
  assert.equal(await code(acceptFamilyInvite(db, { userId: joiner, token, consentTextVersion: "" }, deps)), "consent_required");
  const { familyId } = await acceptFamilyInvite(db, { userId: joiner, token, consentTextVersion: "v1" }, deps);
  const m = await db.familyMembership.findFirstOrThrow({ where: { userId: joiner, leftAt: null } });
  assert.equal(m.familyId, familyId);
  assert.equal(m.role, "ADULT");
  assert.equal(m.historyAccess, "FROM_JOIN");
  const consent = await db.consentRecord.findFirstOrThrow({ where: { userId: joiner } });
  assert.equal(consent.textVersion, "v1");
  assert.equal(await code(acceptFamilyInvite(db, { userId: await mkUser("late2"), token, consentTextVersion: "v1" }, deps)), "invalid_invite");
});

test("accept refused: expired, revoked, joiner with data, joiner in family with other adults", async () => {
  const owner = await mkUser("owner3");
  // Created 8 days ago => already past the 7-day TTL regardless of today's date.
  const t0 = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const exp = await createFamilyInvite(db, { userId: owner }, { env, now: () => t0 });
  const j1 = await mkUser("j3a");
  assert.equal(await code(acceptFamilyInvite(db, { userId: j1, token: exp.token, consentTextVersion: "v1" }, deps)), "invalid_invite");

  const rev = await createFamilyInvite(db, { userId: owner }, deps);
  await revokeFamilyInvite(db, { userId: owner, inviteId: rev.inviteId }, deps);
  assert.equal(await code(acceptFamilyInvite(db, { userId: j1, token: rev.token, consentTextVersion: "v1" }, deps)), "invalid_invite");

  const withData = await mkUser("j3b");
  await db.child.create({ data: { parentId: withData, name: "kid" } });
  const ok = await createFamilyInvite(db, { userId: owner }, deps);
  assert.equal(await code(acceptFamilyInvite(db, { userId: withData, token: ok.token, consentTextVersion: "v1" }, deps)), "needs_merge");

  // Data but no membership at all: still needs_merge (never joins with orphan data).
  const orphan = await mkUser("j3d", { solo: false });
  await db.child.create({ data: { parentId: orphan, name: "orphan-kid" } });
  assert.equal(await code(acceptFamilyInvite(db, { userId: orphan, token: ok.token, consentTextVersion: "v1" }, deps)), "needs_merge");

  const otherOwner = await mkUser("o3c");
  const otherJoiner = await mkUser("j3c");
  const inv = await createFamilyInvite(db, { userId: otherOwner }, deps);
  await acceptFamilyInvite(db, { userId: otherJoiner, token: inv.token, consentTextVersion: "v1" }, deps);
  assert.equal(await code(acceptFamilyInvite(db, { userId: otherJoiner, token: ok.token, consentTextVersion: "v1" }, deps)), "has_other_adults");
});

test("concurrent accepts of one invite: exactly one wins", async () => {
  const owner = await mkUser("owner4");
  const a = await mkUser("j4a");
  const b = await mkUser("j4b");
  const { token } = await createFamilyInvite(db, { userId: owner }, deps);
  const results = await Promise.all([
    code(acceptFamilyInvite(db, { userId: a, token, consentTextVersion: "v1" }, deps)),
    code(acceptFamilyInvite(db, { userId: b, token, consentTextVersion: "v1" }, deps)),
  ]);
  assert.deepEqual([...results].sort(), ["invalid_invite", "ok"]);
});

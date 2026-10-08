/**
 * Family Core M2: invites + consent. Disposable local DB only:
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { ensureFamilyForUser } from "./ensureFamily";
import { previewFamilyInviteMerge } from "./familyMerge.service";
import {
  FamilyInviteError,
  acceptFamilyInvite,
  createFamilyInvite,
  revokeFamilyInvite,
} from "./familyInvite.service";
import { planItemScopeWhere, sharedHistoryFromMembership } from "./familyScope";

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
  await db.childInterest.deleteMany({ where: { child: { parentId: { in: userIds } } } });
  await db.childCustomInterest.deleteMany({ where: { child: { parentId: { in: userIds } } } });
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
  // New invites never expire; a legacy dated invite (pre-M5) must still expire.
  const exp = await createFamilyInvite(db, { userId: owner }, deps);
  assert.equal((await db.familyInvite.findUniqueOrThrow({ where: { id: exp.inviteId } })).expiresAt, null);
  await db.familyInvite.update({ where: { id: exp.inviteId }, data: { expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
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

test("M3b merge: explicit decisions, SAME/ADD/SKIP, plan PRIVATE by default", async () => {
  const owner = await mkUser("owner5");
  const joiner = await mkUser("joiner5");
  const ownerFamily = await ensureFamilyForUser(db, owner);
  const joinerFamily = await ensureFamilyForUser(db, joiner);
  const same = await db.child.create({ data: { parentId: owner, familyId: ownerFamily, createdById: owner, name: "Степа", birthDate: new Date(Date.UTC(2020, 1, 1)), interests: "Плавание" } });
  const jSame = await db.child.create({ data: { parentId: joiner, familyId: joinerFamily, createdById: joiner, name: "степа", birthDate: new Date(Date.UTC(2020, 5, 5)), interests: "Футбол" } });
  const jAdd = await db.child.create({ data: { parentId: joiner, familyId: joinerFamily, createdById: joiner, name: "Маша" } });
  const jSkip = await db.child.create({ data: { parentId: joiner, familyId: joinerFamily, createdById: joiner, name: "Витя" } });
  await db.childInterest.create({ data: { childId: jSame.id, interestSlug: "sport" } });
  await db.childCustomInterest.create({ data: { childId: jSame.id, label: "Лего" } });
  const p1 = await db.planItem.create({ data: { userId: joiner, familyId: joinerFamily, date: "2026-12-01", title: "p1", childId: jSame.id } });
  const p2 = await db.planItem.create({ data: { userId: joiner, familyId: joinerFamily, date: "2026-12-02", title: "p2", childId: jSkip.id } });
  const { token } = await createFamilyInvite(db, { userId: owner }, deps);

  assert.equal(await code(acceptFamilyInvite(db, { userId: joiner, token, consentTextVersion: "v1" }, deps)), "needs_merge");
  const preview = await previewFamilyInviteMerge(db, { userId: joiner, token, consentTextVersion: "v1" });
  assert.equal(preview.suggestions[jSame.id], same.id);
  assert.equal(preview.suggestions[jAdd.id], null);

  // Incomplete decision is rejected, nothing changes.
  assert.equal(
    await code(acceptFamilyInvite(db, { userId: joiner, token, consentTextVersion: "v1", merge: { plan: "PRIVATE", children: [{ childId: jAdd.id, action: "ADD" }] } }, deps)),
    "merge_invalid",
  );
  assert.equal((await db.child.findUniqueOrThrow({ where: { id: jAdd.id } })).familyId, joinerFamily);

  const { familyId } = await acceptFamilyInvite(db, {
    userId: joiner, token, consentTextVersion: "v1",
    merge: { plan: "PRIVATE", children: [
      { childId: jSame.id, action: "SAME", targetChildId: same.id },
      { childId: jAdd.id, action: "ADD" },
      { childId: jSkip.id, action: "SKIP" },
    ] },
  }, deps);
  assert.equal(familyId, ownerFamily);

  assert.equal(await db.child.findUnique({ where: { id: jSame.id } }), null, "duplicate removed");
  const kept = await db.child.findUniqueOrThrow({ where: { id: same.id } });
  assert.equal(kept.birthDate?.getUTCFullYear(), 2020);
  assert.equal(kept.interests, "Плавание, Футбол");
  assert.equal(await db.childInterest.count({ where: { childId: same.id, interestSlug: "sport" } }), 1);
  assert.equal(await db.childCustomInterest.count({ where: { childId: same.id, label: "Лего" } }), 1);
  assert.equal((await db.child.findUniqueOrThrow({ where: { id: jAdd.id } })).familyId, ownerFamily);
  assert.equal((await db.child.findUniqueOrThrow({ where: { id: jSkip.id } })).familyId, joinerFamily, "skipped child stays in the archived family");

  const m1 = await db.planItem.findUniqueOrThrow({ where: { id: p1.id } });
  assert.equal(m1.familyId, ownerFamily);
  assert.equal(m1.visibility, "PRIVATE");
  assert.equal(m1.childId, same.id);
  const m2 = await db.planItem.findUniqueOrThrow({ where: { id: p2.id } });
  assert.equal(m2.childId, null, "skipped child link dropped");
  assert.notEqual((await db.family.findUniqueOrThrow({ where: { id: joinerFamily } })).archivedAt, null);
});

test("preview persists consent before disclosing children; accept reuses it", async () => {
  const owner = await mkUser("cons-owner");
  const joiner = await mkUser("cons-joiner");
  const ownerFamily = await ensureFamilyForUser(db, owner);
  await db.child.create({ data: { parentId: owner, familyId: ownerFamily, createdById: owner, name: "Аня" } });
  const joinerFamily = await ensureFamilyForUser(db, joiner);
  await db.child.create({ data: { parentId: joiner, familyId: joinerFamily, createdById: joiner, name: "Петя" } });
  const { token } = await createFamilyInvite(db, { userId: owner }, deps);

  const preview = await previewFamilyInviteMerge(db, { userId: joiner, token, consentTextVersion: "v1" });
  assert.equal(preview.targetChildren.length, 1);
  const afterPreview = await db.consentRecord.findMany({ where: { userId: joiner, familyId: ownerFamily } });
  assert.equal(afterPreview.length, 1, "consent is recorded at the first disclosure");
  assert.equal(afterPreview[0].type, "FAMILY_SHARED_DATA");
  assert.equal(afterPreview[0].textVersion, "v1");

  await previewFamilyInviteMerge(db, { userId: joiner, token, consentTextVersion: "v1" });
  await acceptFamilyInvite(db, { userId: joiner, token, consentTextVersion: "v1", merge: {
    plan: "SKIP",
    children: [{ childId: (await db.child.findFirstOrThrow({ where: { parentId: joiner } })).id, action: "ADD" }],
  } }, deps);
  assert.equal(await db.consentRecord.count({ where: { userId: joiner, familyId: ownerFamily } }), 1, "no duplicate record");
});

test("FROM_JOIN: past shared events hidden; future, undated and post-join items visible", async () => {
  const owner = await mkUser("hist-owner");
  const joiner = await mkUser("hist-joiner");
  const ownerFamily = await ensureFamilyForUser(db, owner);
  const earlier = new Date(Date.now() - 60_000);
  const mk = (title: string, date: string | null, createdAt: Date) =>
    db.planItem.create({ data: { userId: owner, familyId: ownerFamily, date, title, visibility: "FAMILY", createdAt } });
  // Created before the join:
  const pastEvent = await mk("past", "2020-01-01", earlier);
  const futureEvent = await mk("future", "2099-01-01", earlier);
  const undated = await mk("undated", null, earlier);
  const { token } = await createFamilyInvite(db, { userId: owner }, deps);
  await acceptFamilyInvite(db, { userId: joiner, token, consentTextVersion: "v1" }, deps);
  // Logged after the join, even though the event itself is in the past:
  const loggedLater = await mk("logged-later", "2020-01-02", new Date(Date.now() + 60_000));
  const all = [pastEvent, futureEvent, undated, loggedLater].map((r) => r.id);

  const scopeOf = async (userId: string) => {
    const m = await db.familyMembership.findFirstOrThrow({ where: { userId, leftAt: null } });
    return planItemScopeWhere({ userId, familyId: m.familyId, sharedHistoryFrom: sharedHistoryFromMembership(m) }, true);
  };
  const ids = async (userId: string) =>
    (await db.planItem.findMany({ where: { ...(await scopeOf(userId)), id: { in: all } }, select: { id: true } }))
      .map((r) => r.id).sort();

  assert.deepEqual(await ids(joiner), [futureEvent.id, undated.id, loggedLater.id].sort(), "past hidden, the rest visible");
  assert.deepEqual(await ids(owner), [...all].sort(), "owner (ALL) sees full history");
});

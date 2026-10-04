import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { childScopeFor } from "./familyAccess";
import { ensureFamilyForUser } from "./ensureFamily";
import {
  addPlanItem,
  addPlacePlanItem,
  listArticlePlanItemsBatch,
  listAllPlanItems,
  removePlanItem,
} from "@/server/services/plan.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at an isolated test database");
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const marker = randomUUID();

const setReads = (on: boolean) => {
  if (on) process.env.FAMILY_CORE_READS = "1";
  else delete process.env.FAMILY_CORE_READS;
};

async function main() {
  const a = await prisma.user.create({ data: { email: `fam-reads-a-${marker}@example.invalid` } });
  const b = await prisma.user.create({ data: { email: `fam-reads-b-${marker}@example.invalid` } });
  const solo = await prisma.user.create({ data: { email: `fam-reads-solo-${marker}@example.invalid` } });
  const userIds = [a.id, b.id, solo.id];
  const place = await prisma.place.findFirst({ select: { id: true } });

  try {
    setReads(false);
    // Writes always record the family, even with reads off.
    const itemId = (await addPlanItem(a.id, null, "2026-11-10", undefined, `shared-${marker}`)).id;
    const created = await prisma.planItem.findUniqueOrThrow({ where: { id: itemId } });
    assert.ok(created.familyId);
    assert.equal(created.visibility, "FAMILY");
    assert.equal(created.status, "CONFIRMED");
    const famA = created.familyId!;
    assert.equal(await ensureFamilyForUser(prisma, a.id), famA);

    // Single-adult family: old and new read paths agree.
    const privateItem = await prisma.planItem.create({
      data: { userId: a.id, familyId: famA, date: "2026-11-11", title: `private-${marker}`, visibility: "PRIVATE" },
    });
    const oldPath = (await listAllPlanItems(a.id)).map((i) => i.id).sort();
    setReads(true);
    const newPath = (await listAllPlanItems(a.id)).map((i) => i.id).sort();
    assert.deepEqual(newPath, oldPath);

    // Child ACL: familyId, not parentId.
    const child = await prisma.child.create({
      data: { parentId: a.id, familyId: famA, createdById: a.id, name: "kid" },
    });
    // Second adult joins the same family (membership only; no invite flow in B2).
    await prisma.familyMembership.create({ data: { familyId: famA, userId: b.id, role: "ADULT" } });

    setReads(false);
    assert.equal(await prisma.child.count({ where: { id: child.id, ...(await childScopeFor(b.id)) } }), 0);
    setReads(true);
    assert.equal(await prisma.child.count({ where: { id: child.id, ...(await childScopeFor(b.id)) } }), 1);
    assert.equal(await prisma.child.count({ where: { id: child.id, ...(await childScopeFor(solo.id)) } }), 0);

    // Plan ACL: B sees FAMILY items, never A's PRIVATE; reads off = legacy (B sees nothing).
    const seenByB = (await listAllPlanItems(b.id)).map((i) => i.id);
    assert.ok(seenByB.includes(itemId));
    assert.ok(!seenByB.includes(privateItem.id));
    setReads(false);
    assert.deepEqual(await listAllPlanItems(b.id), []);
    setReads(true);

    // B cannot remove A's PRIVATE item; can remove the FAMILY one.
    await removePlanItem(b.id, privateItem.id);
    assert.ok(await prisma.planItem.findUnique({ where: { id: privateItem.id } }));
    await removePlanItem(b.id, itemId);
    assert.equal(await prisma.planItem.findUnique({ where: { id: itemId } }), null);

    // Flag on, no family: nothing is visible, nothing leaks via parentId/userId.
    await prisma.planItem.create({ data: { userId: solo.id, date: "2026-11-12", title: "legacy-no-family" } });
    assert.deepEqual(await listAllPlanItems(solo.id), []);

    // Cancelled items are hidden by status.
    setReads(false);
    const cancelled = await prisma.planItem.create({
      data: { userId: a.id, familyId: famA, date: "2026-11-13", status: "CANCELLED" },
    });
    assert.ok(!(await listAllPlanItems(a.id)).some((i) => i.id === cancelled.id));

    // P2 regression: a CANCELLED occurrence is history, not an active dedup target.
    const activity = await prisma.activity.create({
      data: {
        ownerUserId: a.id,
        title: `Cancelled dedup ${marker}`,
        shortDesc: "fixture",
        type: "EVENT",
        scheduleMode: "ONE_TIME",
        ageTags: [],
      },
    });
    const oldCancelled = await prisma.planItem.create({
      data: { userId: a.id, familyId: famA, activityId: activity.id, date: "2026-11-15", status: "CANCELLED", title: "old" },
    });
    for (const reads of [false, true]) {
      setReads(reads);
      await prisma.planItem.deleteMany({ where: { activityId: activity.id, status: "CONFIRMED" } });
      const re = await addPlanItem(a.id, activity.id, "2026-11-16");
      assert.equal(re.created, true, `reads=${reads}: re-add must create a new item`);
      assert.notEqual(re.id, oldCancelled.id);
      const fresh = await prisma.planItem.findUniqueOrThrow({ where: { id: re.id } });
      assert.equal(fresh.status, "CONFIRMED");
      assert.equal(fresh.date, "2026-11-16");
      const old = await prisma.planItem.findUniqueOrThrow({ where: { id: oldCancelled.id } });
      assert.equal(old.status, "CANCELLED");
      assert.equal(old.date, "2026-11-15");
      assert.equal(old.title, "old");
      assert.ok((await listAllPlanItems(a.id)).some((i) => i.id === re.id));
    }
    // Same for route/place/article-style dedup via the status lookup helper.
    setReads(false);
    if (place) {
      const cancelledPlace = await prisma.planItem.create({
        data: { userId: a.id, familyId: famA, placeId: place.id, date: "2026-11-17", status: "CANCELLED" },
      });
      const placeItem2 = await addPlacePlanItem(a.id, place.id, "2026-11-18");
      assert.notEqual(placeItem2.id, cancelledPlace.id);
      assert.equal((await prisma.planItem.findUniqueOrThrow({ where: { id: cancelledPlace.id } })).status, "CANCELLED");
    }
    const article = await prisma.article.findFirst({ select: { id: true } });
    if (article) {
      const cancelledArticle = await prisma.planItem.create({
        data: { userId: a.id, familyId: famA, articleId: article.id, date: "2026-11-19", status: "CANCELLED" },
      });
      for (const reads of [false, true]) {
        setReads(reads);
        const rows = await listArticlePlanItemsBatch(a.id, [article.id]);
        assert.ok(!rows.some((r) => r.id === cancelledArticle.id), `reads=${reads}: cancelled must not be "in plan"`);
      }
      setReads(false);
    }

    if (place) {
      const placeItem = await addPlacePlanItem(a.id, place.id, "2026-11-14");
      assert.equal((await prisma.planItem.findUniqueOrThrow({ where: { id: placeItem.id } })).familyId, famA);
    }
  } finally {
    setReads(false);
    const memberships = await prisma.familyMembership.findMany({ where: { userId: { in: userIds } } });
    await prisma.planItem.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.child.deleteMany({ where: { parentId: { in: userIds } } });
    await prisma.family.deleteMany({ where: { id: { in: memberships.map((m) => m.familyId) } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
  console.log("familyCoreReads.integration.test.ts: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { childScopeFor } from "./familyAccess";
import { ensureFamilyForUser } from "./ensureFamily";
import {
  addPlanItem,
  addPlacePlanItem,
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

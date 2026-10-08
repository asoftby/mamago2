import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { ensureFamilyForUser } from "./ensureFamily";
import {
  FamilyBackfillStop,
  runEventsBackfill,
  runFamilyBackfill,
} from "./familyBackfill";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at an isolated test database");
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const marker = randomUUID();

async function mkUser(label: string, deleted = false) {
  return prisma.user.create({
    data: {
      email: `fam-${label}-${marker}@example.invalid`,
      deletedAt: deleted ? new Date() : null,
    },
  });
}

async function expectRejects(fn: () => Promise<unknown>, match: RegExp) {
  await assert.rejects(fn, (error: unknown) => match.test(String((error as Error).message)));
}

async function main() {
  const withChild = await mkUser("child");
  const withPlan = await mkUser("plan");
  const tombstone = await mkUser("tomb", true);
  const empty = await mkUser("empty");
  const userIds = [withChild.id, withPlan.id, tombstone.id, empty.id];

  try {
    await prisma.child.create({ data: { parentId: withChild.id, name: "A" } });
    await prisma.child.create({ data: { parentId: tombstone.id, name: "T" } });
    await prisma.planItem.create({ data: { userId: withPlan.id, date: "2026-10-10" } });
    await prisma.planItem.create({ data: { userId: withChild.id, date: "2026-10-11" } });
    const ev = await prisma.userEvent.create({
      data: { userId: withChild.id, eventType: "PAGE_VIEW" },
    });

    // Dry-run: reports, writes nothing.
    const dry = await runFamilyBackfill(prisma, { dryRun: true });
    assert.equal(dry.dryRun, true);
    assert.ok(dry.candidateUsers >= 2);
    assert.equal(await prisma.family.count({ where: { memberships: { some: { userId: { in: userIds } } } } }), 0);
    assert.equal(await prisma.child.count({ where: { parentId: { in: userIds }, familyId: { not: null } } }), 0);

    // Real run.
    await runFamilyBackfill(prisma, { dryRun: false });
    const mem = await prisma.familyMembership.findMany({ where: { userId: { in: userIds } } });
    assert.deepEqual(mem.map((m) => m.userId).sort(), [withChild.id, withPlan.id].sort());
    assert.ok(mem.every((m) => m.role === "OWNER" && m.historyAccess === "ALL" && m.leftAt === null));
    const child = await prisma.child.findFirstOrThrow({ where: { parentId: withChild.id } });
    const fam = mem.find((m) => m.userId === withChild.id)!.familyId;
    assert.equal(child.familyId, fam);
    assert.equal(child.createdById, withChild.id);
    const plan = await prisma.planItem.findMany({ where: { userId: withChild.id } });
    assert.ok(plan.every((p) => p.familyId === fam && p.visibility === "FAMILY" && p.status === "CONFIRMED"));
    // Tombstone and empty user get nothing.
    assert.equal((await prisma.child.findFirstOrThrow({ where: { parentId: tombstone.id } })).familyId, null);
    assert.equal(await prisma.familyMembership.count({ where: { userId: { in: [tombstone.id, empty.id] } } }), 0);

    // Idempotent.
    const again = await runFamilyBackfill(prisma, { dryRun: false });
    assert.equal(again.familiesCreated, 0);
    assert.equal(again.childrenUpdated, 0);
    assert.equal(again.planItemsUpdated, 0);

    // Lazy family + concurrency: exactly one family/membership.
    const ids = await Promise.all(Array.from({ length: 5 }, () => ensureFamilyForUser(prisma, empty.id)));
    assert.equal(new Set(ids).size, 1);
    assert.equal(await prisma.familyMembership.count({ where: { userId: empty.id, leftAt: null } }), 1);
    assert.equal(await prisma.family.count({ where: { id: { in: ids } } }), 1);

    // Partial-index violations.
    await expectRejects(
      () => prisma.familyMembership.create({ data: { familyId: ids[0], userId: withChild.id } }),
      /Unique constraint|FamilyMembership_active_user/,
    );
    const other = await mkUser("other");
    userIds.push(other.id);
    await expectRejects(
      () => prisma.familyMembership.create({ data: { familyId: fam, userId: other.id, role: "OWNER" } }),
      /Unique constraint|FamilyMembership_active_owner/,
    );

    // CHECK: PRIVATE + PROPOSED forbidden, other combinations fine.
    await expectRejects(
      () => prisma.planItem.create({ data: { userId: withPlan.id, date: "2026-10-12", visibility: "PRIVATE", status: "PROPOSED" } }),
      /check constraint|PlanItem_private_not_proposed_check/i,
    );
    await prisma.planItem.create({ data: { userId: withPlan.id, date: "2026-10-12", visibility: "PRIVATE", status: "CONFIRMED" } });
    await prisma.planItem.create({ data: { userId: withPlan.id, date: "2026-10-12", visibility: "FAMILY", status: "PROPOSED" } });

    // Cross-owner gate stops everything, nothing is guessed.
    const foreignChild = await prisma.child.create({ data: { parentId: withChild.id, name: "X" } });
    const bad = await prisma.planItem.create({ data: { userId: withPlan.id, date: "2026-10-13", childId: foreignChild.id } });
    await assert.rejects(() => runFamilyBackfill(prisma, { dryRun: false }), FamilyBackfillStop);
    await prisma.planItem.delete({ where: { id: bad.id } });

    // Events: only after main backfill; unambiguous user->family only; planVisibility untouched.
    await prisma.child.create({ data: { parentId: withPlan.id, name: "late" } });
    await assert.rejects(() => runEventsBackfill(prisma, { dryRun: false }), FamilyBackfillStop);
    await runFamilyBackfill(prisma, { dryRun: false });
    {
      const dryEvents = await runEventsBackfill(prisma, { dryRun: true });
      assert.ok(dryEvents.eventsUpdated >= 1);
      assert.equal((await prisma.userEvent.findUniqueOrThrow({ where: { id: ev.id } })).familyId, null);
      await runEventsBackfill(prisma, { dryRun: false });
      const after = await prisma.userEvent.findUniqueOrThrow({ where: { id: ev.id } });
      assert.equal(after.familyId, fam);
      assert.equal(after.planVisibility, null);
      assert.equal((await runEventsBackfill(prisma, { dryRun: false })).eventsUpdated, 0);
    }
  } finally {
    await prisma.userEvent.deleteMany({ where: { userId: { in: userIds } } });
    const memberships = await prisma.familyMembership.findMany({ where: { userId: { in: userIds } } });
    await prisma.planItem.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.child.deleteMany({ where: { parentId: { in: userIds } } });
    await prisma.family.deleteMany({ where: { id: { in: memberships.map((m) => m.familyId) } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }
  console.log("familyCoreBackfill.integration.test.ts: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

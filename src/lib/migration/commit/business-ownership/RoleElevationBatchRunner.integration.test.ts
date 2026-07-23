import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { executeRoleElevationBatch } from "./RoleElevationBatchRunner";
import type { RoleElevationGoldenCandidate } from "./RoleElevationGoldenRunner";

const prisma = new PrismaClient();
const pid = process.pid;
/** Isolated per-test namespace — never the shared production source (lesson from Slice 8's leaked-bookkeeping incident). */
const namespace = `role-elevation-batch-test-${pid}`;
const legacyIds = [950001, 950002, 950003];
const emails = legacyIds.map(id => `role-elevation-batch-${pid}-${id}@example.test`);

function candidate(index: number): RoleElevationGoldenCandidate {
  return { sourceRecordKey: `wordpress-db:user:${legacyIds[index]}` };
}

async function seedFixture(index: number, options: { withBusinessLineage?: boolean; withPlace?: boolean } = {}): Promise<{ userId: string }> {
  const withBusinessLineage = options.withBusinessLineage ?? true;
  const withPlace = options.withPlace ?? true;
  const user = await prisma.user.create({ data: { email: emails[index], role: "USER", status: "PENDING_ACTIVATION" } });
  const source = await prisma.migrationSource.upsert({
    where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } },
    create: { adapterKey: "wordpress-db", sourceNamespace: namespace, name: "test fixture — never the real snapshot source" },
    update: {},
  });
  await prisma.migrationLineage.create({
    data: { sourceId: source.id, sourceEntityType: "wordpress-db:user", sourceStableKey: candidate(index).sourceRecordKey, sourceRecordKey: candidate(index).sourceRecordKey, targetType: "USER", targetId: user.id, targetRole: "primary", lastSourceHash: "fixture", isActive: true },
  });
  if (withBusinessLineage) {
    const business = await prisma.business.create({ data: { ownerUserId: user.id, name: `Role Elevation Batch Test Business ${index}` } });
    if (withPlace) await prisma.place.create({ data: { title: `Role Elevation Batch Test Place ${index}`, shortDesc: "fixture", createdByUserId: user.id, ownerBusinessId: business.id } });
    await prisma.migrationLineage.create({
      data: { sourceId: source.id, sourceEntityType: "wordpress-db:user", sourceStableKey: candidate(index).sourceRecordKey, sourceRecordKey: candidate(index).sourceRecordKey, targetType: "BUSINESS", targetRole: "primary", targetId: business.id, lastSourceHash: "fixture", isActive: true },
    });
  }
  return { userId: user.id };
}

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  await prisma.place.deleteMany({ where: { title: { in: legacyIds.map((_, index) => `Role Elevation Batch Test Place ${index}`) } } });
  await prisma.business.deleteMany({ where: { name: { in: legacyIds.map((_, index) => `Role Elevation Batch Test Business ${index}`) } } });
  const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
  if (source) await prisma.migrationSource.delete({ where: { id: source.id } });
  if (users.length > 0) await prisma.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
}

test("elevates all clean candidates in order, and reruns are all SKIP_UNCHANGED", async () => {
  await cleanup();
  try {
    await seedFixture(0);
    await seedFixture(1);
    await seedFixture(2);
    const manifest = [candidate(0), candidate(1), candidate(2)];

    const first = await executeRoleElevationBatch(prisma, manifest, {}, namespace);
    assert.deepEqual({ total: first.total, processed: first.processed, elevate: first.elevate, skipUnchanged: first.skipUnchanged, blocked: first.blocked, stoppedEarly: first.stoppedEarly }, {
      total: 3, processed: 3, elevate: 3, skipUnchanged: 0, blocked: 0, stoppedEarly: false,
    });
    assert.ok(first.results.every(result => result.action === "ELEVATE"));
    for (const key of [0, 1, 2]) {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[key] } });
      assert.equal(user.role, "BUSINESS_OWNER");
      assert.equal(user.status, "PENDING_ACTIVATION");
    }

    const rerun = await executeRoleElevationBatch(prisma, manifest, {}, namespace);
    assert.deepEqual({ elevate: rerun.elevate, skipUnchanged: rerun.skipUnchanged, blocked: rerun.blocked, stoppedEarly: rerun.stoppedEarly }, { elevate: 0, skipUnchanged: 3, blocked: 0, stoppedEarly: false });
  } finally {
    await cleanup();
  }
});

test("stops immediately on the first BLOCKED candidate, leaving already-elevated ones in place and not touching later ones", async () => {
  await cleanup();
  try {
    await seedFixture(0);
    // Candidate 1 has no Business lineage at all -> BUSINESS_LINEAGE_MISSING.
    await seedFixture(1, { withBusinessLineage: false });
    await seedFixture(2);
    const manifest = [candidate(0), candidate(1), candidate(2)];

    const afterEachCalls: string[] = [];
    const result = await executeRoleElevationBatch(prisma, manifest, { afterEach: async entryResult => { afterEachCalls.push(entryResult.sourceRecordKey); } }, namespace);

    assert.equal(result.stoppedEarly, true);
    assert.equal(result.processed, 2, "must stop after the blocked second candidate, never reaching the third");
    assert.deepEqual(result.results.map(entry => entry.action), ["ELEVATE", "BLOCKED"]);
    assert.deepEqual(afterEachCalls, [candidate(0).sourceRecordKey, candidate(1).sourceRecordKey]);

    const user0 = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] } });
    assert.equal(user0.role, "BUSINESS_OWNER", "the already-elevated candidate must not be rolled back");
    const user2 = await prisma.user.findUniqueOrThrow({ where: { email: emails[2] } });
    assert.equal(user2.role, "USER", "a candidate after the block point must never be processed");
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { executeBusinessOwnershipBatch } from "./BusinessOwnershipBatchRunner";
import type { BusinessOwnershipGoldenCandidate } from "./BusinessOwnershipGoldenRunner";

const prisma = new PrismaClient();
const pid = process.pid;
/** Isolated per-test namespace — never the shared production "users-immutable-snapshot" source, so test bookkeeping never mixes with real migration history. */
const namespace = `business-ownership-batch-test-${pid}`;
const legacyIds = [930001, 930002, 930003];
const emails = legacyIds.map(id => `business-ownership-batch-${pid}-${id}@example.test`);
const placePostIds = legacyIds.map(id => `${id}`);

function candidate(index: number): BusinessOwnershipGoldenCandidate {
  return { sourceRecordKey: `wordpress-db:user:${legacyIds[index]}`, legacyUserId: legacyIds[index], placeSourcePostIds: [placePostIds[index]] };
}

async function seedUserAndPlace(index: number): Promise<{ userId: string; placeId: string }> {
  const user = await prisma.user.create({ data: { email: emails[index], role: "USER", status: "PENDING_ACTIVATION", displayName: `Batch Test Business ${index}` } });
  const place = await prisma.place.create({ data: { title: `Batch Test Place ${index}`, shortDesc: "fixture", createdByUserId: user.id, ownerBusinessId: null } });
  const source = await prisma.migrationSource.upsert({
    where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } },
    create: { adapterKey: "wordpress-db", sourceNamespace: namespace, name: "test fixture — never the real snapshot source" },
    update: {},
  });
  await prisma.migrationLineage.create({
    data: {
      sourceId: source.id,
      sourceEntityType: "wordpress-db:user",
      sourceStableKey: candidate(index).sourceRecordKey,
      sourceRecordKey: candidate(index).sourceRecordKey,
      targetType: "USER",
      targetId: user.id,
      targetRole: "primary",
      lastSourceHash: "fixture",
      isActive: true,
    },
  });
  await prisma.migrationLineage.create({
    data: {
      sourceId: source.id,
      sourceEntityType: "wordpress-db:places",
      sourceStableKey: `wordpress-db:places:${placePostIds[index]}`,
      sourceRecordKey: `wordpress-db:places:${placePostIds[index]}`,
      targetType: "PLACE",
      targetId: place.id,
      targetRole: "primary",
      lastSourceHash: "fixture",
      isActive: true,
    },
  });
  return { userId: user.id, placeId: place.id };
}

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, business: { select: { id: true } } } });
  const businessIds = users.map(user => user.business?.id).filter((id): id is string => Boolean(id));
  if (businessIds.length > 0) await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  await prisma.place.deleteMany({ where: { title: { in: legacyIds.map((_, index) => `Batch Test Place ${index}`) } } });
  // Deleting the isolated test MigrationSource cascades away its MigrationLineage, MigrationRecord, and MigrationRun rows in one step.
  const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
  if (source) await prisma.migrationSource.delete({ where: { id: source.id } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}

test("processes all candidates in order when every one is clean, and reruns are all SKIP_UNCHANGED", async () => {
  await cleanup();
  try {
    await seedUserAndPlace(0);
    await seedUserAndPlace(1);
    await seedUserAndPlace(2);
    const manifest = [candidate(0), candidate(1), candidate(2)];

    const first = await executeBusinessOwnershipBatch(prisma, manifest, {}, namespace);
    assert.deepEqual({ total: first.total, processed: first.processed, create: first.create, skipUnchanged: first.skipUnchanged, blocked: first.blocked, stoppedEarly: first.stoppedEarly }, {
      total: 3, processed: 3, create: 3, skipUnchanged: 0, blocked: 0, stoppedEarly: false,
    });
    assert.ok(first.results.every(result => result.action === "CREATE" && result.businessId));

    const rerun = await executeBusinessOwnershipBatch(prisma, manifest, {}, namespace);
    assert.deepEqual({ create: rerun.create, skipUnchanged: rerun.skipUnchanged, blocked: rerun.blocked, stoppedEarly: rerun.stoppedEarly }, { create: 0, skipUnchanged: 3, blocked: 0, stoppedEarly: false });
    assert.deepEqual(
      rerun.results.map(result => result.businessId),
      first.results.map(result => result.businessId),
    );
  } finally {
    await cleanup();
  }
});

test("stops immediately on the first BLOCKED candidate, leaving already-written ones in place and not touching later ones", async () => {
  await cleanup();
  try {
    await seedUserAndPlace(0);
    // Candidate 1 is deliberately unwritable: no lineage seeded at all -> USER_LINEAGE_MISSING.
    await seedUserAndPlace(2);
    const manifest = [candidate(0), candidate(1), candidate(2)];

    const afterEachCalls: string[] = [];
    const result = await executeBusinessOwnershipBatch(prisma, manifest, { afterEach: async entryResult => { afterEachCalls.push(entryResult.sourceRecordKey); } }, namespace);

    assert.equal(result.stoppedEarly, true);
    assert.equal(result.processed, 2, "must stop after the blocked second candidate, never reaching the third");
    assert.deepEqual(
      result.results.map(entry => entry.action),
      ["CREATE", "BLOCKED"],
    );
    assert.deepEqual(afterEachCalls, [candidate(0).sourceRecordKey, candidate(1).sourceRecordKey]);

    // Candidate 0 was already written and must remain; candidate 2 was never reached, so it has no Business.
    const user0 = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] }, select: { business: { select: { id: true } } } });
    assert.ok(user0.business, "the already-written candidate must not be rolled back");
    const user2 = await prisma.user.findUniqueOrThrow({ where: { email: emails[2] }, select: { business: { select: { id: true } } } });
    assert.equal(user2.business, null, "a candidate after the block point must never be processed");
  } finally {
    await cleanup();
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

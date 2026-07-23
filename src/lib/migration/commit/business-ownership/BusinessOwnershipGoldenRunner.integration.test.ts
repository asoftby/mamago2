import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { planBusinessOwnershipGolden, writeBusinessOwnershipGolden, type BusinessOwnershipGoldenCandidate } from "./BusinessOwnershipGoldenRunner";

const prisma = new PrismaClient();
const namespace = `business-ownership-golden-test-${process.pid}`;
const email = `business-ownership-golden-${process.pid}@example.test`;
const legacyUserId = 920001;
const placePostId = "920001";
const userSourceRecordKey = `wordpress-db:user:${legacyUserId}` as const;
const placeSourceRecordKey = `wordpress-db:places:${placePostId}`;

function candidate(): BusinessOwnershipGoldenCandidate {
  return { sourceRecordKey: userSourceRecordKey, legacyUserId, placeSourcePostIds: [placePostId] };
}

async function cleanup(): Promise<void> {
  const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
  if (source) await prisma.migrationSource.delete({ where: { id: source.id } });
  await prisma.user.deleteMany({ where: { email } });
}

async function seedFixture(options: { role?: "USER" | "ADMIN"; placeOwnerBusinessId?: string | null } = {}): Promise<{ userId: string; placeId: string; sourceId: string }> {
  const user = await prisma.user.create({ data: { email, role: options.role ?? "USER", status: "PENDING_ACTIVATION", displayName: "Golden Test Business" } });
  const place = await prisma.place.create({
    data: { title: "Golden Test Place", shortDesc: "fixture", createdByUserId: user.id, ownerBusinessId: options.placeOwnerBusinessId ?? null },
  });
  const source = await prisma.migrationSource.upsert({
    where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } },
    create: { adapterKey: "wordpress-db", sourceNamespace: namespace, name: "test fixture" },
    update: {},
  });
  await prisma.migrationLineage.create({
    data: {
      sourceId: source.id,
      sourceEntityType: "wordpress-db:user",
      sourceStableKey: userSourceRecordKey,
      sourceRecordKey: userSourceRecordKey,
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
      sourceStableKey: placeSourceRecordKey,
      sourceRecordKey: placeSourceRecordKey,
      targetType: "PLACE",
      targetId: place.id,
      targetRole: "primary",
      lastSourceHash: "fixture",
      isActive: true,
    },
  });
  return { userId: user.id, placeId: place.id, sourceId: source.id };
}

test("first run creates a Business, links the Place, and records BUSINESS lineage; rerun is SKIP_UNCHANGED with zero mutation", async () => {
  await cleanup();
  try {
    const { userId, placeId, sourceId } = await seedFixture();

    const plan = await planBusinessOwnershipGolden(prisma, candidate(), namespace);
    assert.equal(plan.action, "CREATE");
    assert.equal(plan.targetUserId, userId);
    assert.deepEqual(plan.targetPlaceIds, [placeId]);

    const result = await writeBusinessOwnershipGolden(prisma, plan, namespace);
    assert.equal(result.action, "CREATE");
    assert.ok(result.businessId);

    const business = await prisma.business.findUniqueOrThrow({ where: { id: result.businessId! } });
    assert.equal(business.ownerUserId, userId);
    assert.equal(business.name, "Golden Test Business");

    const place = await prisma.place.findUniqueOrThrow({ where: { id: placeId } });
    assert.equal(place.ownerBusinessId, result.businessId);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(user.role, "USER", "role must never be changed by the ownership write");

    const lineage = await prisma.migrationLineage.findUniqueOrThrow({
      where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId, sourceRecordKey: userSourceRecordKey, targetType: "BUSINESS", targetRole: "primary" } },
    });
    assert.equal(lineage.targetId, result.businessId);
    assert.equal(lineage.isActive, true);

    // Rerun: idempotent, no new writes.
    const beforeBusinessCount = await prisma.business.count();
    const beforeLineageCount = await prisma.migrationLineage.count({ where: { sourceId } });
    const rerunPlan = await planBusinessOwnershipGolden(prisma, candidate(), namespace);
    assert.equal(rerunPlan.action, "SKIP_UNCHANGED");
    const rerunResult = await writeBusinessOwnershipGolden(prisma, rerunPlan, namespace);
    assert.equal(rerunResult.action, "SKIP_UNCHANGED");
    assert.equal(rerunResult.businessId, result.businessId);
    assert.equal(await prisma.business.count(), beforeBusinessCount);
    assert.equal(await prisma.migrationLineage.count({ where: { sourceId } }), beforeLineageCount);
  } finally {
    const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
    if (source) {
      const businessLineage = await prisma.migrationLineage.findUnique({
        where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: source.id, sourceRecordKey: userSourceRecordKey, targetType: "BUSINESS", targetRole: "primary" } },
      });
      if (businessLineage?.targetId) await prisma.business.deleteMany({ where: { id: businessLineage.targetId } });
    }
    await prisma.place.deleteMany({ where: { title: "Golden Test Place" } });
    await cleanup();
  }
});

test("missing User lineage is BLOCKED and performs no write", async () => {
  await cleanup();
  try {
    const plan = await planBusinessOwnershipGolden(prisma, candidate(), namespace);
    assert.equal(plan.action, "BLOCKED");
    assert.equal(plan.reason, "USER_LINEAGE_MISSING");
    const result = await writeBusinessOwnershipGolden(prisma, plan, namespace);
    assert.equal(result.action, "BLOCKED");
    assert.equal(await prisma.business.count({ where: { name: "Golden Test Business" } }), 0);
  } finally {
    await cleanup();
  }
});

test("Place already owned by a different Business is BLOCKED and never overwritten", async () => {
  await cleanup();
  try {
    const otherOwner = await prisma.user.create({ data: { email: `${email}-other`, role: "USER", status: "ACTIVE" } });
    const otherBusiness = await prisma.business.create({ data: { ownerUserId: otherOwner.id, name: "Other Business" } });
    const { placeId } = await seedFixture({ placeOwnerBusinessId: otherBusiness.id });

    const plan = await planBusinessOwnershipGolden(prisma, candidate(), namespace);
    assert.equal(plan.action, "BLOCKED");
    assert.equal(plan.reason, "PLACE_ALREADY_OWNED_BY_OTHER_BUSINESS");

    const result = await writeBusinessOwnershipGolden(prisma, plan, namespace);
    assert.equal(result.action, "BLOCKED");
    const place = await prisma.place.findUniqueOrThrow({ where: { id: placeId } });
    assert.equal(place.ownerBusinessId, otherBusiness.id, "existing ownership must never be overwritten");

    await prisma.place.deleteMany({ where: { id: placeId } });
    await prisma.business.deleteMany({ where: { id: otherBusiness.id } });
    await prisma.user.deleteMany({ where: { id: otherOwner.id } });
  } finally {
    await prisma.place.deleteMany({ where: { title: "Golden Test Place" } });
    await cleanup();
  }
});

test("target User with an elevated role is BLOCKED, never silently processed", async () => {
  await cleanup();
  try {
    await seedFixture({ role: "ADMIN" });
    const plan = await planBusinessOwnershipGolden(prisma, candidate(), namespace);
    assert.equal(plan.action, "BLOCKED");
    assert.equal(plan.reason, "TARGET_USER_ROLE_NOT_ELIGIBLE");
  } finally {
    await prisma.place.deleteMany({ where: { title: "Golden Test Place" } });
    await cleanup();
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

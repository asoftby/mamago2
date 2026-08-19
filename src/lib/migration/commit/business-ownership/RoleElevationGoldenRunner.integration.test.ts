import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { planRoleElevationGolden, writeRoleElevationGolden, type RoleElevationGoldenCandidate } from "./RoleElevationGoldenRunner";

const prisma = new PrismaClient();
/** Isolated per-test namespace — never the shared production "users-immutable-snapshot" source (lesson from Slice 8's leaked-bookkeeping incident). */
const namespace = `role-elevation-golden-test-${process.pid}`;
const legacyUserId = 940001;
const email = `role-elevation-golden-${process.pid}@example.test`;
const otherEmail = `role-elevation-golden-other-${process.pid}@example.test`;
const userSourceRecordKey = `wordpress-db:user:${legacyUserId}` as const;

function candidate(): RoleElevationGoldenCandidate {
  return { sourceRecordKey: userSourceRecordKey };
}

async function cleanup(): Promise<void> {
  const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
  if (source) await prisma.migrationSource.delete({ where: { id: source.id } });
  await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } });
}

interface SeedOptions {
  role?: "USER" | "ADMIN" | "BUSINESS_OWNER";
  createBusiness?: boolean;
  businessOwnerIsOther?: boolean;
  linkPlace?: boolean;
  skipBusinessLineage?: boolean;
  skipUserLineage?: boolean;
}

async function seedFixture(options: SeedOptions = {}): Promise<{ userId: string }> {
  const user = await prisma.user.create({ data: { email, role: options.role ?? "USER", status: "PENDING_ACTIVATION", passwordHash: null, emailVerifiedAt: null } });
  const source = await prisma.migrationSource.upsert({
    where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } },
    create: { adapterKey: "wordpress-db", sourceNamespace: namespace, name: "test fixture — never the real snapshot source" },
    update: {},
  });

  if (!options.skipUserLineage) {
    await prisma.migrationLineage.create({
      data: { sourceId: source.id, sourceEntityType: "wordpress-db:user", sourceStableKey: userSourceRecordKey, sourceRecordKey: userSourceRecordKey, targetType: "USER", targetId: user.id, targetRole: "primary", lastSourceHash: "fixture", isActive: true },
    });
  }

  if (options.createBusiness ?? true) {
    const ownerUser = options.businessOwnerIsOther ? await prisma.user.create({ data: { email: otherEmail, role: "USER", status: "ACTIVE" } }) : user;
    const business = await prisma.business.create({ data: { ownerUserId: ownerUser.id, name: "Role Elevation Test Business" } });
    if (options.linkPlace ?? true) {
      await prisma.place.create({ data: { title: "Role Elevation Test Place", shortDesc: "fixture", createdByUserId: user.id, ownerBusinessId: business.id } });
    }
    if (!options.skipBusinessLineage) {
      await prisma.migrationLineage.create({
        data: { sourceId: source.id, sourceEntityType: "wordpress-db:user", sourceStableKey: userSourceRecordKey, sourceRecordKey: userSourceRecordKey, targetType: "BUSINESS", targetId: business.id, targetRole: "primary", lastSourceHash: "fixture", isActive: true },
      });
    }
  }

  return { userId: user.id };
}

test("elevates USER to BUSINESS_OWNER when ownership was already established, touching nothing else; rerun is SKIP_UNCHANGED", async () => {
  await cleanup();
  try {
    const { userId } = await seedFixture();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const plan = await planRoleElevationGolden(prisma, candidate(), namespace);
    assert.equal(plan.action, "ELEVATE");
    assert.equal(plan.targetUserId, userId);

    const result = await writeRoleElevationGolden(prisma, plan);
    assert.equal(result.action, "ELEVATE");

    const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    assert.equal(after.role, "BUSINESS_OWNER");
    assert.equal(after.status, before.status);
    assert.equal(after.passwordHash, before.passwordHash);
    assert.equal(after.emailVerifiedAt, before.emailVerifiedAt);
    assert.equal(after.email, before.email);

    assert.equal(await prisma.session.count({ where: { userId } }), 0);
    assert.equal(await prisma.userActionToken.count({ where: { userId } }), 0);

    const businessCountBefore = await prisma.business.count();
    const placeOwnershipBefore = await prisma.place.findMany({ where: { createdByUserId: userId }, select: { ownerBusinessId: true } });

    const rerunPlan = await planRoleElevationGolden(prisma, candidate(), namespace);
    assert.equal(rerunPlan.action, "SKIP_UNCHANGED");
    const rerunResult = await writeRoleElevationGolden(prisma, rerunPlan);
    assert.equal(rerunResult.action, "SKIP_UNCHANGED");

    assert.equal(await prisma.business.count(), businessCountBefore);
    const placeOwnershipAfter = await prisma.place.findMany({ where: { createdByUserId: userId }, select: { ownerBusinessId: true } });
    assert.deepEqual(placeOwnershipAfter, placeOwnershipBefore);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).role, "BUSINESS_OWNER");
  } finally {
    await prisma.place.deleteMany({ where: { title: "Role Elevation Test Place" } });
    await prisma.business.deleteMany({ where: { name: "Role Elevation Test Business" } });
    await cleanup();
  }
});

test("missing User lineage is BLOCKED and performs no write", async () => {
  await cleanup();
  try {
    await seedFixture({ skipUserLineage: true });
    const plan = await planRoleElevationGolden(prisma, candidate(), namespace);
    assert.equal(plan.action, "BLOCKED");
    assert.equal(plan.reason, "USER_LINEAGE_MISSING");
    const result = await writeRoleElevationGolden(prisma, plan);
    assert.equal(result.action, "BLOCKED");
  } finally {
    await prisma.place.deleteMany({ where: { title: "Role Elevation Test Place" } });
    await prisma.business.deleteMany({ where: { name: "Role Elevation Test Business" } });
    await cleanup();
  }
});

test("missing Business lineage is BLOCKED (ownership was never proven to be from a migration write)", async () => {
  await cleanup();
  try {
    await seedFixture({ skipBusinessLineage: true });
    const plan = await planRoleElevationGolden(prisma, candidate(), namespace);
    assert.equal(plan.action, "BLOCKED");
    assert.equal(plan.reason, "BUSINESS_LINEAGE_MISSING");
  } finally {
    await prisma.place.deleteMany({ where: { title: "Role Elevation Test Place" } });
    await prisma.business.deleteMany({ where: { name: "Role Elevation Test Business" } });
    await cleanup();
  }
});

test("Business owned by a different User is BLOCKED, never elevates the wrong person", async () => {
  await cleanup();
  try {
    await seedFixture({ businessOwnerIsOther: true });
    const plan = await planRoleElevationGolden(prisma, candidate(), namespace);
    assert.equal(plan.action, "BLOCKED");
    assert.equal(plan.reason, "BUSINESS_OWNER_MISMATCH");
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    assert.equal(user.role, "USER");
  } finally {
    await prisma.place.deleteMany({ where: { title: "Role Elevation Test Place" } });
    await prisma.business.deleteMany({ where: { name: "Role Elevation Test Business" } });
    await cleanup();
  }
});

test("no Place linked to the Business is BLOCKED — ownership must already be established, not just the Business shell", async () => {
  await cleanup();
  try {
    await seedFixture({ linkPlace: false });
    const plan = await planRoleElevationGolden(prisma, candidate(), namespace);
    assert.equal(plan.action, "BLOCKED");
    assert.equal(plan.reason, "PLACE_OWNERSHIP_NOT_LINKED");
  } finally {
    await prisma.business.deleteMany({ where: { name: "Role Elevation Test Business" } });
    await cleanup();
  }
});

test("a target User who is already ADMIN is BLOCKED, never silently elevated/demoted", async () => {
  await cleanup();
  try {
    await seedFixture({ role: "ADMIN" });
    const plan = await planRoleElevationGolden(prisma, candidate(), namespace);
    assert.equal(plan.action, "BLOCKED");
    assert.equal(plan.reason, "TARGET_USER_ROLE_NOT_ELIGIBLE");
    const result = await writeRoleElevationGolden(prisma, plan);
    assert.equal(result.action, "BLOCKED");
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    assert.equal(user.role, "ADMIN", "an existing elevated role must never be touched");
  } finally {
    await prisma.place.deleteMany({ where: { title: "Role Elevation Test Place" } });
    await prisma.business.deleteMany({ where: { name: "Role Elevation Test Business" } });
    await cleanup();
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { buildUserDraft, normalizeUserCandidate, planUserMigration, writeUserMigration, type UserSourceCandidate } from "./UserMigrationVerticalSlice";

const prisma = new PrismaClient();
const namespace = `users-slice4-test-${process.pid}`;
const email = `users-slice4-${process.pid}@example.test`;

function source(): UserSourceCandidate {
  return { sourceRecordKey: "wordpress-db:user:7", sourceSystem: "wordpress-db", legacyUserId: 7, email, displayName: "Integration Fixture", firstName: null, lastName: null, phone: null, sourceCreatedAt: null, legacyRoles: ["custom"], legacyPasswordPresent: false, businessLinked: false, businessEvidence: { exactOwnership: false, placeCount: 0 }, privilegedCollision: false, profileMediaReferencePresent: false, sourceHash: "fixture-source" };
}

async function cleanup(): Promise<void> {
  const migrationSource = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
  if (migrationSource) await prisma.migrationSource.delete({ where: { id: migrationSource.id } });
  await prisma.user.deleteMany({ where: { email } });
}

test("atomic create, lineage, record, rerun and concurrent duplicate protection", async () => {
  await cleanup();
  try {
    const candidate = normalizeUserCandidate(source());
    const plan = await planUserMigration(prisma, candidate, namespace);
    assert.equal(plan.action, "CREATE");
    const [a, b] = await Promise.allSettled([writeUserMigration(prisma, plan, namespace), writeUserMigration(prisma, plan, namespace)]);
    assert.equal([a, b].filter(result => result.status === "fulfilled").length, 1);
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { sessions: true, actionTokens: true } });
    assert.equal(user.status, "PENDING_ACTIVATION");
    assert.equal(user.role, "USER");
    assert.equal(user.passwordHash, null);
    assert.equal(user.emailVerifiedAt, null);
    assert.equal(user.sessions.length, 0);
    assert.equal(user.actionTokens.length, 0);
    const sourceRow = await prisma.migrationSource.findUniqueOrThrow({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
    assert.equal(await prisma.migrationLineage.count({ where: { sourceId: sourceRow.id, sourceRecordKey: candidate.sourceRecordKey, targetType: "USER" } }), 1);
    assert.equal(await prisma.migrationRecord.count({ where: { sourceId: sourceRow.id } }), 1, "failed concurrent transaction must leave no partial record");
    const rerunPlan = await planUserMigration(prisma, candidate, namespace);
    assert.equal(rerunPlan.action, "SKIP_UNCHANGED");
    const rerun = await writeUserMigration(prisma, rerunPlan, namespace);
    assert.equal(rerun.action, "SKIP_UNCHANGED");
    assert.equal(await prisma.user.count({ where: { email } }), 1);
    assert.equal(await prisma.migrationLineage.count({ where: { sourceId: sourceRow.id } }), 1);
    assert.equal(await prisma.migrationRecord.count({ where: { sourceId: sourceRow.id } }), 2);
  } finally { await cleanup(); }
});

test("existing email collision blocks and rollback leaves no bookkeeping", async () => {
  await cleanup();
  try {
    await prisma.user.create({ data: { email, role: "USER", status: "ACTIVE", passwordHash: "preserve" } });
    const candidate = normalizeUserCandidate(source());
    const plan = await planUserMigration(prisma, candidate, namespace);
    assert.equal(plan.action, "BLOCKED");
    assert.equal(plan.reason, "EXISTING_USER_EMAIL_COLLISION");
    await writeUserMigration(prisma, plan, namespace);
    const existing = await prisma.user.findUniqueOrThrow({ where: { email } });
    assert.equal(existing.passwordHash, "preserve");
    assert.equal(existing.status, "ACTIVE");
    const badPlan = { ...plan, action: "CREATE" as const, reason: null, draft: buildUserDraft(candidate) };
    await assert.rejects(writeUserMigration(prisma, badPlan, `${namespace}-rollback`));
    assert.equal(await prisma.migrationSource.count({ where: { sourceNamespace: `${namespace}-rollback` } }), 0);
  } finally {
    const rollbackSource = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: `${namespace}-rollback` } } });
    if (rollbackSource) await prisma.migrationSource.delete({ where: { id: rollbackSource.id } });
    await cleanup();
  }
});

test.after(async () => { await prisma.$disconnect(); });

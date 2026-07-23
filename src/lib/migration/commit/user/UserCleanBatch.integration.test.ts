import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { calculateCleanUserManifestHash, executeCleanUserBatch, type CleanUserManifest, type CleanUserManifestEntry } from "./UserCleanBatch";
import { normalizeUserCandidate, planUserMigration, writeUserMigration, type UserSourceCandidate } from "./UserMigrationVerticalSlice";

const prisma = new PrismaClient();
const namespace = `users-clean-batch-test-${process.pid}`;
const keys = [91001, 91002, 91003];
const emails = keys.map(id => `users-clean-${process.pid}-${id}@example.test`);

function source(key: string): UserSourceCandidate {
  const id = Number(key.split(":").at(-1));
  return { sourceRecordKey: key as UserSourceCandidate["sourceRecordKey"], sourceSystem: "wordpress-db", legacyUserId: id, email: emails[keys.indexOf(id)], displayName: null, firstName: null, lastName: null, phone: null, sourceCreatedAt: null, legacyRoles: [], legacyPasswordPresent: false, businessLinked: false, businessEvidence: { exactOwnership: false, placeCount: 0 }, privilegedCollision: false, profileMediaReferencePresent: false, sourceHash: "fixture" };
}

function manifest(): CleanUserManifest {
  const entries: CleanUserManifestEntry[] = keys.map((id, index) => ({ sourceRecordKey: `wordpress-db:user:${id}`, classification: "ORDINARY", canonicalCandidateHash: `fixture-${id}`, expectedFirstAction: index === 0 ? "SKIP_UNCHANGED" : "CREATE", expectedRerunAction: "SKIP_UNCHANGED" }));
  const base = { version: 1 as const, sourceSnapshotSha256: "fixture", candidateCount: entries.length, excludedCount: 0, batchSize: 2, entries };
  return { ...base, manifestHash: calculateCleanUserManifestHash(base) };
}

async function cleanup(): Promise<void> {
  const migrationSource = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
  if (migrationSource) await prisma.migrationSource.delete({ where: { id: migrationSource.id } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}

test("mixed existing/new manifest executes sequentially and reruns idempotently", async () => {
  await cleanup();
  try {
    const golden = normalizeUserCandidate(source(`wordpress-db:user:${keys[0]}`));
    await writeUserMigration(prisma, await planUserMigration(prisma, golden, namespace), namespace);
    const audits: number[] = [];
    const dependencies = {
      loadCandidate: (_root: string, key: string) => source(key),
      plan: (client: PrismaClient, candidate: ReturnType<typeof normalizeUserCandidate>) => planUserMigration(client, candidate, namespace),
      write: (client: PrismaClient, plan: Awaited<ReturnType<typeof planUserMigration>>) => writeUserMigration(client, plan, namespace),
    };
    const first = await executeCleanUserBatch({ prisma, manifest: manifest(), snapshotRoot: "unused", phase: "FIRST_RUN", afterBatch: async state => { audits.push(state.processed); }, dependencies });
    assert.deepEqual({ create: first.create, skip: first.skipUnchanged, batches: first.completedBatches }, { create: 2, skip: 1, batches: 2 });
    assert.deepEqual(audits, [2, 3]);
    const rerun = await executeCleanUserBatch({ prisma, manifest: manifest(), snapshotRoot: "unused", phase: "RERUN", afterBatch: async () => {}, dependencies });
    assert.deepEqual({ create: rerun.create, skip: rerun.skipUnchanged }, { create: 0, skip: 3 });
    const migrationSource = await prisma.migrationSource.findUniqueOrThrow({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
    assert.equal(await prisma.user.count({ where: { email: { in: emails } } }), 3);
    assert.equal(await prisma.migrationLineage.count({ where: { sourceId: migrationSource.id } }), 3);
    assert.equal(await prisma.migrationRecord.count({ where: { sourceId: migrationSource.id } }), 7, "seed + first run + rerun attempts");
    assert.equal(await prisma.session.count({ where: { user: { email: { in: emails } } } }), 0);
    assert.equal(await prisma.userActionToken.count({ where: { user: { email: { in: emails } } } }), 0);
  } finally { await cleanup(); }
});

test("changed source hash blocks without updating an existing migrated User", async () => {
  await cleanup();
  try {
    const candidate = normalizeUserCandidate(source(`wordpress-db:user:${keys[0]}`));
    const created = await writeUserMigration(prisma, await planUserMigration(prisma, candidate, namespace), namespace);
    const migrationSource = await prisma.migrationSource.findUniqueOrThrow({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
    await prisma.migrationLineage.update({ where: { sourceId_sourceRecordKey_targetType_targetRole: { sourceId: migrationSource.id, sourceRecordKey: candidate.sourceRecordKey, targetType: "USER", targetRole: "primary" } }, data: { lastSourceHash: "intentionally-different" } });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: created.targetId! } });
    const plan = await planUserMigration(prisma, candidate, namespace);
    assert.equal(plan.action, "BLOCKED");
    assert.equal(plan.reason, "MIGRATED_USER_SOURCE_CHANGED");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: created.targetId! } });
    assert.deepEqual(after, before);
  } finally { await cleanup(); }
});

test.after(async () => { await prisma.$disconnect(); });

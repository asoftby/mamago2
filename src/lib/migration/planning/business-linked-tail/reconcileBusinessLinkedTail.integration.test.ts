import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { canonicalHash } from "@/lib/migration/planning/user-ownership/canonicalJson";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "@/lib/migration/planning/user-ownership/readOnlyRepository";

import { reconcileBusinessLinkedTail } from "./reconcileBusinessLinkedTail";

/**
 * Self-contained fixture: a dedicated test namespace (mirroring
 * BusinessOwnershipGoldenRunner.integration.test.ts's convention) plus an
 * ephemeral snapshot directory written to the OS temp dir for the duration
 * of this test only — not an immutable source-of-truth snapshot (see
 * prelaunch-checklist.md Rule 14). This makes the test independent of the
 * lost `/tmp/scratchpad/users/` snapshot while still exercising the real
 * reconciliation algorithm against real Prisma-backed migrated data.
 */
const prisma = new PrismaClient();
const readOnlyClient = createReadOnlyPrismaClient(prisma);
const repository = createUserOwnershipReadOnlyRepository(readOnlyClient);

const namespace = `business-linked-tail-test-${process.pid}`;
const legacyUserId = 930001;
const userSourceRecordKey = `wordpress-db:user:${legacyUserId}`;
const targetKeys = [userSourceRecordKey];
const migratedPlacePostId = "930001";
const missingDraftPlacePostId = "930002";
const missingUnpublishedPlacePostId = "930003";
const email = `business-linked-tail-${process.pid}@example.test`;

let snapshotRoot: string;

function buildSnapshotFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "business-linked-tail-test-"));
  mkdirSync(join(root, "analysis"), { recursive: true });
  mkdirSync(join(root, "raw"), { recursive: true });

  const inventory = {
    users: [
      {
        sourceRecordKey: userSourceRecordKey,
        ownership: { placePostIds: [migratedPlacePostId, missingDraftPlacePostId, missingUnpublishedPlacePostId] },
      },
    ],
  };
  writeFileSync(join(root, "analysis/users-inventory.json"), JSON.stringify(inventory));

  const tsvLines = [
    "snapshot_section",
    "SECTION content_authorship",
    "ID\tpost_author\tpost_type\tpost_status",
    `${migratedPlacePostId}\t${legacyUserId}\tplaces\tpublish`,
    `${missingDraftPlacePostId}\t${legacyUserId}\tplaces\tdraft`,
    `${missingUnpublishedPlacePostId}\t${legacyUserId}\tplaces\tunpublished`,
  ];
  writeFileSync(join(root, "raw/users-source-capture.tsv"), tsvLines.join("\n") + "\n");

  return root;
}

async function cleanup(): Promise<void> {
  const source = await prisma.migrationSource.findUnique({ where: { adapterKey_sourceNamespace: { adapterKey: "wordpress-db", sourceNamespace: namespace } } });
  if (source) await prisma.migrationSource.delete({ where: { id: source.id } });
  await prisma.place.deleteMany({ where: { title: "Business Linked Tail Test Place" } });
  await prisma.user.deleteMany({ where: { email } });
}

async function seedFixture(): Promise<{ userId: string; placeId: string; sourceId: string }> {
  const user = await prisma.user.create({ data: { email, role: "USER", status: "PENDING_ACTIVATION", displayName: "Business Linked Tail Test" } });
  const place = await prisma.place.create({ data: { title: "Business Linked Tail Test Place", shortDesc: "fixture", createdByUserId: user.id, ownerBusinessId: null } });
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
      sourceStableKey: `wordpress-db:places:${migratedPlacePostId}`,
      sourceRecordKey: `wordpress-db:places:${migratedPlacePostId}`,
      targetType: "PLACE",
      targetId: place.id,
      targetRole: "primary",
      lastSourceHash: "fixture",
      isActive: true,
    },
  });
  return { userId: user.id, placeId: place.id, sourceId: source.id };
}

test.before(async () => {
  snapshotRoot = buildSnapshotFixture();
  await cleanup();
  await seedFixture();
});

test.after(async () => {
  await cleanup();
  rmSync(snapshotRoot, { recursive: true, force: true });
  await prisma.$disconnect();
});

test("reconciles the targeted user with a deterministic, evidence-backed verdict", async () => {
  const entries = await reconcileBusinessLinkedTail(readOnlyClient, snapshotRoot, targetKeys);
  assert.equal(entries.length, 1);
  assert.deepEqual(
    entries.map(entry => entry.sourceRecordKey),
    targetKeys,
  );

  const [entry] = entries;
  assert.equal(entry.userLineagePresent, true);
  assert.equal(entry.migratedPlacesConflictFree, true);
  assert.equal(entry.anyMissingPlaceEverAttempted, false);
  assert.equal(entry.verdict, "TARGET_PLACE_NOT_MIGRATED");
  assert.equal(entry.placeCoverage.totalOwnedPlaces, 3);
  assert.equal(entry.placeCoverage.migratedPlaces, 1);
  assert.equal(entry.placeCoverage.missingPlaces, 2);
  assert.deepEqual(entry.placeCoverage.missingPlacesBySourceStatus, { draft: 1, unpublished: 1 });
  const attributed = Object.values(entry.placeCoverage.missingPlacesBySourceStatus).reduce((a, b) => a + b, 0);
  assert.equal(attributed, entry.placeCoverage.missingPlaces);
});

test("running twice against the same snapshot and DB state yields identical evidence hashes", async () => {
  const first = await reconcileBusinessLinkedTail(readOnlyClient, snapshotRoot, targetKeys);
  const second = await reconcileBusinessLinkedTail(readOnlyClient, snapshotRoot, targetKeys);
  assert.deepEqual(
    first.map(entry => entry.evidenceHash),
    second.map(entry => entry.evidenceHash),
  );
});

test("performs zero database writes: before/after counts and a role/status distribution hash are identical", async () => {
  const before = await repository.captureBaselineCounts();
  const beforeRoles = canonicalHash(await repository.roleStatusDistribution());

  await reconcileBusinessLinkedTail(readOnlyClient, snapshotRoot, targetKeys);

  const after = await repository.captureBaselineCounts();
  const afterRoles = canonicalHash(await repository.roleStatusDistribution());

  assert.deepEqual(before, after);
  assert.equal(beforeRoles, afterRoles);
});

test("committed-shape entries contain no email, phone, password, or raw WordPress metadata", async () => {
  const entries = await reconcileBusinessLinkedTail(readOnlyClient, snapshotRoot, targetKeys);
  const serialized = JSON.stringify(entries);
  assert.equal(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(serialized), false, "must not contain an email address");
  for (const forbidden of ["passwordHash", "password", "legacyLogin", "displayName", "phoneE164"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, `must not contain "${forbidden}"`);
  }
});

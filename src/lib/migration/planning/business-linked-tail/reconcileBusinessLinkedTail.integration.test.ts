import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { canonicalHash } from "@/lib/migration/planning/user-ownership/canonicalJson";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "@/lib/migration/planning/user-ownership/readOnlyRepository";

import { reconcileBusinessLinkedTail } from "./reconcileBusinessLinkedTail";

const snapshotRoot = "/tmp/scratchpad/users";
const prisma = new PrismaClient();
const readOnlyClient = createReadOnlyPrismaClient(prisma);
const repository = createUserOwnershipReadOnlyRepository(readOnlyClient);
const targetKeys = ["wordpress-db:user:89", "wordpress-db:user:130"];

test("reconciles exactly the 2 targeted users with a deterministic, evidence-backed verdict", async () => {
  const entries = await reconcileBusinessLinkedTail(readOnlyClient, snapshotRoot, targetKeys);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(entry => entry.sourceRecordKey), [...targetKeys].sort());

  for (const entry of entries) {
    assert.equal(entry.userLineagePresent, true);
    assert.equal(entry.migratedPlacesConflictFree, true);
    assert.equal(entry.anyMissingPlaceEverAttempted, false);
    assert.equal(entry.verdict, "TARGET_PLACE_NOT_MIGRATED");
    assert.ok(entry.placeCoverage.missingPlaces > 0);
    const attributed = Object.values(entry.placeCoverage.missingPlacesBySourceStatus).reduce((a, b) => a + b, 0);
    assert.equal(attributed, entry.placeCoverage.missingPlaces);
  }

  const user89 = entries.find(entry => entry.sourceRecordKey === "wordpress-db:user:89")!;
  assert.equal(user89.placeCoverage.totalOwnedPlaces, 214);
  assert.equal(user89.placeCoverage.migratedPlaces, 19);
  assert.equal(user89.placeCoverage.missingPlaces, 195);

  const user130 = entries.find(entry => entry.sourceRecordKey === "wordpress-db:user:130")!;
  assert.equal(user130.placeCoverage.totalOwnedPlaces, 2);
  assert.equal(user130.placeCoverage.migratedPlaces, 1);
  assert.equal(user130.placeCoverage.missingPlaces, 1);
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

test.after(async () => {
  await prisma.$disconnect();
});

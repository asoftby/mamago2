import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { buildPlanningManifests } from "./buildPlanningManifests";
import { canonicalJsonString } from "./canonicalJson";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "./readOnlyRepository";

const snapshotRoot = "/tmp/scratchpad/users";
const prisma = new PrismaClient();
const readOnlyClient = createReadOnlyPrismaClient(prisma);
const repository = createUserOwnershipReadOnlyRepository(readOnlyClient);

test("aggregate totals arithmetically reconcile against the real snapshot", async () => {
  const manifests = await buildPlanningManifests(snapshotRoot, repository);

  assert.equal(manifests.manualBacklog.length, 15);
  assert.equal(manifests.businessOwnershipPlan.length, 38);
  assert.equal(manifests.contentAuthorshipPlan.length, 12);

  const m = manifests.summary.manual;
  assert.equal(m.total, 15);
  assert.equal(m.automaticActions, 0);
  const manualSum = Object.values(m.dispositionCounts).reduce((a, b) => a + b, 0);
  assert.equal(manualSum, 15);

  const b = manifests.summary.businessOwnership;
  assert.equal(b.users, 38);
  assert.equal(b.exactCandidates + b.alreadySatisfied + b.missingTarget + b.conflicts + b.ambiguousOrManual + b.unsupported, 38);
  assert.equal(b.ownershipWrites, 0);
  assert.equal(b.roleChanges, 0);

  const c = manifests.summary.contentAuthorship;
  assert.equal(c.users, 12);
  assert.equal(c.exactCandidates + c.alreadySatisfied + c.missingTarget + c.conflicts + c.ambiguousOrManual + c.unsupported, 12);
  assert.equal(c.authorshipWrites, 0);
});

test("running the analyzer twice against the same snapshot and DB state yields identical manifests and hashes", async () => {
  const first = await buildPlanningManifests(snapshotRoot, repository);
  const second = await buildPlanningManifests(snapshotRoot, repository);
  assert.deepEqual(first.hashes, second.hashes);
  assert.equal(canonicalJsonString(first.manualBacklog), canonicalJsonString(second.manualBacklog));
  assert.equal(canonicalJsonString(first.businessOwnershipPlan), canonicalJsonString(second.businessOwnershipPlan));
  assert.equal(canonicalJsonString(first.contentAuthorshipPlan), canonicalJsonString(second.contentAuthorshipPlan));
});

test("committed-shape manifests contain no email, phone, password, or raw WordPress metadata", async () => {
  const manifests = await buildPlanningManifests(snapshotRoot, repository);
  const serialized = JSON.stringify({ manual: manifests.manualBacklog, business: manifests.businessOwnershipPlan, content: manifests.contentAuthorshipPlan });

  // No email-shaped substring anywhere in the committed artifacts.
  assert.equal(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(serialized), false, "must not contain an email address");
  for (const forbidden of ["passwordHash", "password", "legacyLogin", "displayName", "phoneE164", "activationToken", "capabilities"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, `must not contain "${forbidden}"`);
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

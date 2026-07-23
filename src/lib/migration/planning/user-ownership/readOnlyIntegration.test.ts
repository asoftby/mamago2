import assert from "node:assert/strict";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { buildPlanningManifests } from "./buildPlanningManifests";
import { canonicalHash } from "./canonicalJson";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "./readOnlyRepository";
import { loadClassification } from "./snapshotEvidence";

const snapshotRoot = "/tmp/scratchpad/users";
const prisma = new PrismaClient();
const readOnlyClient = createReadOnlyPrismaClient(prisma);
const repository = createUserOwnershipReadOnlyRepository(readOnlyClient);

test("clean User lineages are exactly 564 and manual/privileged User lineages are exactly 0", async () => {
  const classification = loadClassification(snapshotRoot);
  const manualLineage = await repository.findLineageTargetIds("USER", classification.manualPrivileged);
  assert.equal(manualLineage.size, 0);

  const totalUserLineage = await prisma.migrationLineage.count({ where: { targetType: "USER" } });
  assert.equal(totalUserLineage, 564);
});

test("all 38 business-linked and 12 content-author migrated Users have a User lineage (they are part of the clean 564)", async () => {
  const classification = loadClassification(snapshotRoot);
  const businessLineage = await repository.findLineageTargetIds("USER", classification.businessLinked);
  const authorLineage = await repository.findLineageTargetIds("USER", classification.contentAuthor);
  assert.equal(businessLineage.size, 38);
  assert.equal(authorLineage.size, 12);
});

test("the analyzer performs zero database writes: before/after counts and a role/status distribution hash are identical", async () => {
  const before = await repository.captureBaselineCounts();
  const beforeRoles = canonicalHash(await repository.roleStatusDistribution());

  await buildPlanningManifests(snapshotRoot, repository);

  const after = await repository.captureBaselineCounts();
  const afterRoles = canonicalHash(await repository.roleStatusDistribution());

  assert.deepEqual(before, after);
  assert.equal(beforeRoles, afterRoles);
});

test.after(async () => {
  await prisma.$disconnect();
});

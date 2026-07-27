import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PrismaClient } from "@prisma/client";

import { buildPlanningManifests } from "./buildPlanningManifests";
import { canonicalJsonString } from "./canonicalJson";
import { createReadOnlyPrismaClient, createUserOwnershipReadOnlyRepository } from "./readOnlyRepository";

const prisma = new PrismaClient();
const readOnlyClient = createReadOnlyPrismaClient(prisma);
const repository = createUserOwnershipReadOnlyRepository(readOnlyClient);

const MANUAL_COUNT = 15;
const BUSINESS_COUNT = 38;
const CONTENT_COUNT = 12;

/**
 * Self-contained synthetic snapshot fixture written to the OS temp dir for
 * the duration of this test file only — not an immutable source-of-truth
 * snapshot (see prelaunch-checklist.md Rule 14). Uses fake, non-colliding
 * legacy WordPress IDs (900xxx) so every classification outcome below is
 * deterministic and independent of any real migrated data: none of these
 * sourceRecordKeys have real User/Place/Article lineage, so every entry
 * resolves to a `MANUAL_REVIEW` (missing User lineage) or, for the manual
 * backlog, `EXCLUDE_FROM_MIGRATION` (no collision, no evidence) — this
 * exercises the same arithmetic/hash/PII invariants the real snapshot did,
 * without depending on it.
 */
function buildSyntheticSnapshot(): string {
  const root = mkdtempSync(join(tmpdir(), "planning-manifests-test-"));
  mkdirSync(join(root, "analysis"), { recursive: true });
  mkdirSync(join(root, "raw"), { recursive: true });

  const manualKeys = Array.from({ length: MANUAL_COUNT }, (_, i) => `wordpress-db:user:900${100 + i}`);
  const businessKeys = Array.from({ length: BUSINESS_COUNT }, (_, i) => `wordpress-db:user:900${200 + i}`);
  const contentKeys = Array.from({ length: CONTENT_COUNT }, (_, i) => `wordpress-db:user:900${400 + i}`);

  const classification = {
    sourceScope: 579,
    classes: {
      H: { count: MANUAL_COUNT, sourceRecordKeys: manualKeys },
      C: { count: BUSINESS_COUNT, sourceRecordKeys: businessKeys },
      D: { count: CONTENT_COUNT, sourceRecordKeys: contentKeys },
    },
    reconciliation: { sumOfClasses: MANUAL_COUNT + BUSINESS_COUNT + CONTENT_COUNT, equalsSourceScope: false, cleanScope: 564, blockedOrManualScope: MANUAL_COUNT },
  };
  writeFileSync(join(root, "analysis/users-classification.json"), JSON.stringify(classification));

  const emptyOwnership = { authoredCounts: {}, placePostIds: [] as string[], offerPostIds: [] as string[], articlePostIds: [] as string[], routePostIds: [] as string[] };
  const inventoryUsers = [
    ...manualKeys.map(sourceRecordKey => ({
      sourceRecordKey,
      roles: ["administrator"],
      identityConfidence: "LOW",
      emailCollision: false,
      existingLocalUserCandidates: [] as Array<{ role: string; status: string }>,
      ownership: emptyOwnership,
    })),
    ...businessKeys.map(sourceRecordKey => ({
      sourceRecordKey,
      roles: [] as string[],
      identityConfidence: "HIGH",
      emailCollision: false,
      existingLocalUserCandidates: [] as Array<{ role: string; status: string }>,
      ownership: emptyOwnership,
    })),
  ];
  writeFileSync(join(root, "analysis/users-inventory.json"), JSON.stringify({ users: inventoryUsers }));

  const tsvLines = ["snapshot_section", "SECTION content_authorship", "ID\tpost_author\tpost_type"];
  writeFileSync(join(root, "raw/users-source-capture.tsv"), tsvLines.join("\n") + "\n");

  return root;
}

let snapshotRoot: string;

test.before(() => {
  snapshotRoot = buildSyntheticSnapshot();
});

test.after(async () => {
  rmSync(snapshotRoot, { recursive: true, force: true });
  await prisma.$disconnect();
});

test("aggregate totals arithmetically reconcile against the synthetic snapshot", async () => {
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

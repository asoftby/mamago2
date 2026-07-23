import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "@prisma/client";

import { buildCleanUserManifest, calculateCleanUserManifestHash, executeCleanUserBatch, validateCleanUserManifest, type CleanUserManifest, type CleanUserManifestEntry } from "./UserCleanBatch";
import type { UserSourceCandidate } from "./UserMigrationVerticalSlice";

const snapshotRoot = "/tmp/scratchpad/users";

function clone(manifest: CleanUserManifest): CleanUserManifest { return JSON.parse(JSON.stringify(manifest)) as CleanUserManifest; }
function rehash(manifest: CleanUserManifest): CleanUserManifest { return { ...manifest, manifestHash: calculateCleanUserManifestHash(manifest) }; }

test("real clean manifest is exactly 564 approved candidates", () => {
  const manifest = buildCleanUserManifest(snapshotRoot);
  const summary = validateCleanUserManifest(manifest, snapshotRoot);
  assert.deepEqual({ entries: summary.entries, duplicates: summary.duplicates, missing: summary.missingCandidates, unknown: summary.unknownCandidates, privileged: summary.privilegedCandidates, creates: summary.expectedCreate, skips: summary.expectedSkip }, { entries: 564, duplicates: 0, missing: 0, unknown: 0, privileged: 0, creates: 562, skips: 2 });
  assert.equal(manifest.entries.some(entry => entry.sourceRecordKey === "wordpress-db:user:1"), false);
});

test("manifest rejects hash, duplicate, missing, unknown, privileged, canonical and action mismatches", () => {
  const base = buildCleanUserManifest(snapshotRoot);
  assert.throws(() => validateCleanUserManifest({ ...base, manifestHash: "bad" }, snapshotRoot), /HASH_MISMATCH/);
  const duplicate = clone(base); duplicate.entries = [...duplicate.entries.slice(0, -1), duplicate.entries[0]]; assert.throws(() => validateCleanUserManifest(rehash(duplicate), snapshotRoot));
  const missing = clone(base); missing.entries = missing.entries.slice(1); missing.candidateCount = missing.entries.length; assert.throws(() => validateCleanUserManifest(rehash(missing), snapshotRoot));
  const unknown = clone(base); unknown.entries = [{ ...unknown.entries[0], sourceRecordKey: "wordpress-db:user:999999" }, ...unknown.entries.slice(1)]; assert.throws(() => validateCleanUserManifest(rehash(unknown), snapshotRoot));
  const privileged = clone(base); privileged.entries = [{ ...privileged.entries[0], sourceRecordKey: "wordpress-db:user:1" }, ...privileged.entries.slice(1)]; assert.throws(() => validateCleanUserManifest(rehash(privileged), snapshotRoot));
  const canonical = clone(base); canonical.entries = [{ ...canonical.entries[0], canonicalCandidateHash: "changed" }, ...canonical.entries.slice(1)]; assert.throws(() => validateCleanUserManifest(rehash(canonical), snapshotRoot), /CANDIDATE_MISMATCH/);
  const action = clone(base); action.entries = [{ ...action.entries[0], expectedFirstAction: action.entries[0].expectedFirstAction === "CREATE" ? "SKIP_UNCHANGED" : "CREATE" }, ...action.entries.slice(1)]; assert.throws(() => validateCleanUserManifest(rehash(action), snapshotRoot), /ACTION_MISMATCH/);
  assert.throws(() => validateCleanUserManifest(rehash({ ...clone(base), sourceSnapshotSha256: "bad" }), snapshotRoot), /SNAPSHOT_HASH_MISMATCH/);
});

function source(key: string): UserSourceCandidate {
  return { sourceRecordKey: key as UserSourceCandidate["sourceRecordKey"], sourceSystem: "wordpress-db", legacyUserId: Number(key.split(":").at(-1)), email: `${key.split(":").at(-1)}@example.test`, displayName: null, firstName: null, lastName: null, phone: null, sourceCreatedAt: null, legacyRoles: [], legacyPasswordPresent: false, businessLinked: false, businessEvidence: { exactOwnership: false, placeCount: 0 }, privilegedCollision: false, profileMediaReferencePresent: false, sourceHash: "source" };
}

function tinyManifest(count: number, batchSize: number): CleanUserManifest {
  const entries: CleanUserManifestEntry[] = Array.from({ length: count }, (_, index) => ({ sourceRecordKey: `wordpress-db:user:${index + 100}` as const, classification: "ORDINARY", canonicalCandidateHash: `hash-${index}`, expectedFirstAction: "CREATE", expectedRerunAction: "SKIP_UNCHANGED" }));
  const base = { version: 1 as const, sourceSnapshotSha256: "snapshot", candidateCount: count, excludedCount: 0, batchSize, entries };
  return { ...base, manifestHash: calculateCleanUserManifestHash(base) };
}

test("batch execution is sequential and audits between batches", async () => {
  const events: string[] = [];
  let active = 0;
  const summary = await executeCleanUserBatch({ prisma: {} as PrismaClient, manifest: tinyManifest(5, 2), snapshotRoot: "unused", phase: "FIRST_RUN", afterBatch: async state => { events.push(`audit:${state.batchNumber}:${state.processed}`); }, dependencies: {
    loadCandidate: (_root, key) => source(key),
    plan: async (_prisma, candidate) => ({ sourceRecordKey: candidate.sourceRecordKey, action: "CREATE", reason: null, canonicalHash: "x", candidate, draft: null, targetId: null, warnings: [] }),
    write: async (_prisma, plan) => { active += 1; assert.equal(active, 1); events.push(`start:${plan.sourceRecordKey}`); await Promise.resolve(); events.push(`end:${plan.sourceRecordKey}`); active -= 1; return { action: "CREATE", targetId: plan.sourceRecordKey, recordId: plan.sourceRecordKey }; },
  } });
  assert.equal(summary.completedBatches, 3);
  assert.deepEqual(events.filter(event => event.startsWith("audit")), ["audit:1:2", "audit:2:4", "audit:3:5"]);
  assert.ok(events.indexOf("audit:1:2") < events.indexOf("start:wordpress-db:user:102"));
});

test("first unexpected result stops and preserves completed prefix", async () => {
  const writes: string[] = [];
  await assert.rejects(executeCleanUserBatch({ prisma: {} as PrismaClient, manifest: tinyManifest(4, 2), snapshotRoot: "unused", phase: "FIRST_RUN", afterBatch: async () => {}, dependencies: {
    loadCandidate: (_root, key) => source(key),
    plan: async (_prisma, candidate) => ({ sourceRecordKey: candidate.sourceRecordKey, action: candidate.legacyUserId === 102 ? "BLOCKED" : "CREATE", reason: candidate.legacyUserId === 102 ? "EXISTING_USER_EMAIL_COLLISION" : null, canonicalHash: "x", candidate, draft: null, targetId: null, warnings: [] }),
    write: async (_prisma, plan) => { writes.push(plan.sourceRecordKey); return { action: "CREATE", targetId: plan.sourceRecordKey, recordId: plan.sourceRecordKey }; },
  } }), /CLEAN_BATCH_STOP/);
  assert.deepEqual(writes, ["wordpress-db:user:100", "wordpress-db:user:101"]);
});

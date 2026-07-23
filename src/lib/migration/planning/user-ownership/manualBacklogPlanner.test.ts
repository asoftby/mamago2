import assert from "node:assert/strict";
import test from "node:test";

import { planManualBacklog } from "./manualBacklogPlanner";
import type { ManualSourceEvidence } from "./snapshotEvidence";

function evidence(overrides: Partial<ManualSourceEvidence> & { sourceRecordKey: string }): ManualSourceEvidence {
  return {
    roles: ["administrator"],
    identityConfidence: "LOW",
    emailCollision: false,
    localCandidateRoles: [],
    ownershipEvidenceCount: 0,
    authorshipEvidenceCount: 0,
    ...overrides,
  };
}

const FIFTEEN: ManualSourceEvidence[] = [
  evidence({ sourceRecordKey: "wordpress-db:user:1", emailCollision: true, localCandidateRoles: ["ADMIN"], ownershipEvidenceCount: 42, authorshipEvidenceCount: 13 }),
  ...Array.from({ length: 14 }, (_, i) => evidence({ sourceRecordKey: `wordpress-db:user:${i + 2}` })),
];

test("produces exactly 15 entries for 15 source users", () => {
  const backlog = planManualBacklog(FIFTEEN);
  assert.equal(backlog.length, 15);
});

test("wordpress-db:user:1 is present with a keep-existing-target disposition and forbidden automatic role change", () => {
  const backlog = planManualBacklog(FIFTEEN);
  const entry = backlog.find(e => e.sourceRecordKey === "wordpress-db:user:1");
  assert.ok(entry, "wordpress-db:user:1 must be present");
  assert.equal(entry!.recommendedDisposition, "KEEP_EXISTING_TARGET_UNCHANGED");
  assert.equal(entry!.automaticRoleChange, "FORBIDDEN");
  assert.equal(entry!.requiresHumanDecision, true);
  assert.equal(entry!.collisionType, "EMAIL_COLLISION_PRIVILEGED_TARGET");
  assert.ok(entry!.reasonCodes.includes("PRIVILEGED_TARGET_COLLISION"));
});

test("rejects a duplicate sourceRecordKey", () => {
  const withDuplicate = [...FIFTEEN, evidence({ sourceRecordKey: "wordpress-db:user:1" })];
  assert.throws(() => planManualBacklog(withDuplicate), /Duplicate/);
});

test("every entry gets exactly one recommended disposition and requires human decision", () => {
  const backlog = planManualBacklog(FIFTEEN);
  const allowed = new Set(["KEEP_EXISTING_TARGET_UNCHANGED", "MANUAL_LINK_AFTER_IDENTITY_VERIFICATION", "MANUAL_CREATE_PENDING_ACCOUNT", "EXCLUDE_FROM_MIGRATION", "REQUIRES_FOUNDER_DECISION"]);
  for (const entry of backlog) {
    assert.ok(allowed.has(entry.recommendedDisposition));
    assert.equal(entry.requiresHumanDecision, true);
    assert.equal(entry.automaticRoleChange, "FORBIDDEN");
  }
});

test("evidence with real ownership or authorship footprint is escalated to a founder decision, never auto-migrated", () => {
  const withFootprint = [evidence({ sourceRecordKey: "wordpress-db:user:99", authorshipEvidenceCount: 5 })];
  const [entry] = planManualBacklog(withFootprint);
  assert.equal(entry.recommendedDisposition, "REQUIRES_FOUNDER_DECISION");
  assert.ok(entry.reasonCodes.includes("AUTHORSHIP_REQUIRES_MANUAL_REVIEW"));
});

test("privileged account with zero observable footprint and no collision is recommended for exclusion, not silent auto-creation", () => {
  const noFootprint = [evidence({ sourceRecordKey: "wordpress-db:user:100" })];
  const [entry] = planManualBacklog(noFootprint);
  assert.equal(entry.recommendedDisposition, "EXCLUDE_FROM_MIGRATION");
});

test("manifest entries never carry email, name, phone, login, or password fields", () => {
  const backlog = planManualBacklog(FIFTEEN);
  const serialized = JSON.stringify(backlog);
  for (const forbidden of ["email", "Email", "phone", "Phone", "password", "Password", "login", "Login", "displayName", "@gmail", "@mail", "@list.ru"]) {
    assert.equal(serialized.includes(forbidden), false, `manifest must not contain "${forbidden}"`);
  }
});

test("same input produces the same evidence hash for every entry, deterministically", () => {
  const first = planManualBacklog(FIFTEEN);
  const second = planManualBacklog(FIFTEEN);
  assert.deepEqual(
    first.map(e => e.evidenceHash),
    second.map(e => e.evidenceHash),
  );
});

test("a change in evidence changes that entry's hash", () => {
  const [a] = planManualBacklog([evidence({ sourceRecordKey: "wordpress-db:user:5", ownershipEvidenceCount: 0 })]);
  const [b] = planManualBacklog([evidence({ sourceRecordKey: "wordpress-db:user:5", ownershipEvidenceCount: 1 })]);
  assert.notEqual(a.evidenceHash, b.evidenceHash);
});

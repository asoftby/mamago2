import assert from "node:assert/strict";
import test from "node:test";

import {
  assertBackfillPlanMatchesApproval,
  hashBackfillEmail,
  parseApprovedUserBackfillManifest,
} from "./productionExclusionBackfillPolicy";

const H = (letter: string) => letter.repeat(64);
const approvedAt = new Date(Date.now() - 60_000).toISOString();
const entry = {
  sourceRecordKey: "wordpress-db:user:43",
  emailSha256: hashBackfillEmail("test-person@example.com"),
  canonicalHash: H("b"),
  sourceHash: H("c"),
  action: "CREATE" as const,
};
const approval = () => ({
  schemaVersion: 1,
  issue: 1064,
  approvedBy: "FOUNDER",
  approvedAt,
  entries: [entry],
});
const plan = () => ({
  sourceRecordKey: entry.sourceRecordKey,
  action: "CREATE",
  canonicalHash: entry.canonicalHash,
  candidate: { normalizedEmail: "test-person@example.com" },
  draft: {
    role: "USER", status: "PENDING_ACTIVATION",
    passwordHash: null, emailVerifiedAt: null,
  },
});

test("accepts exact, founder-approved excluded user scope", () => {
  assert.deepEqual(parseApprovedUserBackfillManifest(approval()).entries, [entry]);
  assert.equal(hashBackfillEmail("  Test-Person@Example.Com "), entry.emailSha256);
  assert.doesNotThrow(() => assertBackfillPlanMatchesApproval(entry, plan(), entry.sourceHash));
});

test("idempotent skip must match the same reviewed identity and source", () => {
  assert.doesNotThrow(() => assertBackfillPlanMatchesApproval(
    entry, { ...plan(), action: "SKIP_UNCHANGED" }, entry.sourceHash,
  ));
  assert.throws(() => assertBackfillPlanMatchesApproval(
    entry, { ...plan(), action: "BLOCKED" }, entry.sourceHash,
  ), /BACKFILL_APPROVAL_MISMATCH/);
});

test("never permits admin/source key 1, unknown key, or arbitrary WP user", () => {
  for (const key of ["wordpress-db:user:1", "wordpress-db:user:7", "wordpress-db:user:17", "wordpress-db:user:22", "wordpress-db:user:42", "wordpress-db:user:38", "wordpress-db:user:999"]) {
    assert.throws(() => parseApprovedUserBackfillManifest({
      ...approval(), entries: [{ ...entry, sourceRecordKey: key }],
    }), /BACKFILL_MANIFEST_ENTRY_INVALID/);
  }
});

test("requires explicit FOUNDER approval and exact manifest schema", () => {
  assert.throws(() => parseApprovedUserBackfillManifest({
    ...approval(), approvedBy: "OPERATOR",
  }), /BACKFILL_MANIFEST_INVALID/);
  assert.throws(() => parseApprovedUserBackfillManifest({
    ...approval(), allowAllUsers: true,
  }), /BACKFILL_MANIFEST_INVALID/);
  assert.throws(() => parseApprovedUserBackfillManifest({
    ...approval(), entries: [{ ...entry, deleteExisting: true }],
  }), /BACKFILL_MANIFEST_ENTRY_INVALID/);
  assert.throws(() => parseApprovedUserBackfillManifest({
    ...approval(), entries: [entry, entry],
  }), /BACKFILL_MANIFEST_ENTRY_INVALID/);
  assert.throws(() => parseApprovedUserBackfillManifest({
    ...approval(), entries: [],
  }), /BACKFILL_MANIFEST_INVALID/);
  assert.throws(() => parseApprovedUserBackfillManifest({
    ...approval(), approvedAt: "2999-01-01T00:00:00.000Z",
  }), /BACKFILL_MANIFEST_INVALID/);
});

test("rejects any source/email/hash drift or role escalation", () => {
  const mutations = [
    { ...plan(), sourceRecordKey: "wordpress-db:user:7" },
    { ...plan(), canonicalHash: H("d") },
    { ...plan(), candidate: { normalizedEmail: "different@example.com" } },
    { ...plan(), candidate: { normalizedEmail: null } },
    { ...plan(), draft: { ...plan().draft, role: "BUSINESS_OWNER" } },
    { ...plan(), draft: { ...plan().draft, status: "ACTIVE" } },
    { ...plan(), draft: { ...plan().draft, passwordHash: "hash" } },
    { ...plan(), draft: null },
  ];
  for (const mutation of mutations) {
    assert.throws(() => assertBackfillPlanMatchesApproval(
      entry, mutation, entry.sourceHash,
    ), /BACKFILL_APPROVAL_MISMATCH/);
  }
  assert.throws(() => assertBackfillPlanMatchesApproval(
    entry, plan(), H("d"),
  ), /BACKFILL_APPROVAL_MISMATCH/);
});

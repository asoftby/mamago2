import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  FIVE_RECOVERY_KEYS, FIVE_RECOVERY_NAMESPACE,
  assertFiveRecoveryPlanApproved,
  parseFiveRecoveryArgs, parseFiveRecoveryManifest,
  verifyFiveRecoveryManifestBytes,
} from "./wordpressFiveArchiveBackfillPolicy";
import { hashBackfillEmail } from "./productionExclusionBackfillPolicy";

const SHA = (char: string) => char.repeat(64);
const approval = () => ({
  schemaVersion: 1,
  issue: 1064,
  approvedBy: "FOUNDER",
  approvedAt: new Date(Date.now() - 60_000).toISOString(),
  archiveSha256: SHA("a"),
  sourceNamespace: FIVE_RECOVERY_NAMESPACE,
  entries: FIVE_RECOVERY_KEYS.map((sourceRecordKey, index) => ({
    sourceRecordKey,
    emailSha256: hashBackfillEmail("account" + index + "@example.com"),
    canonicalHash: SHA("b"), sourceHash: SHA("c"),
    action: "CREATE",
  })),
});
const flags = [
  "--confirm-writes", "--confirm-production",
  "--acknowledge-prod-user-import",
  "--acknowledge-exclusion-backfill",
  "--confirm-five-user-archive-recovery",
  "--confirm-backup-restored",
  "--backup-reference", "restored-isolated-pg16-backup",
  "--manifest", "/secure/approved-five.json",
  "--reviewed-manifest-sha256", SHA("d"),
];

test("five identities and archive namespace are strict and ordered", () => {
  assert.deepEqual([...FIVE_RECOVERY_KEYS], [
    "wordpress-db:user:7", "wordpress-db:user:17",
    "wordpress-db:user:22", "wordpress-db:user:42",
    "wordpress-db:user:43",
  ]);
  assert.deepEqual(parseFiveRecoveryManifest(approval()).entries, approval().entries);
});

test("commit flags require explicit operator approval and backup", () => {
  assert.equal(parseFiveRecoveryArgs(flags).approvedManifest, "/secure/approved-five.json");
  for (const item of flags.filter(x => x.startsWith("--"))) {
    if (["--manifest", "--backup-reference", "--reviewed-manifest-sha256"].includes(item)) continue;
    assert.throws(() => parseFiveRecoveryArgs(flags.filter(x => x !== item)),
      /FIVE_RECOVERY_PROD_OPERATOR_APPROVAL_REQUIRED/);
  }
  for (const injected of [
    [], ["--preview"], [...flags, "--all-users"],
    [...flags, "--confirm-writes"],
    [...flags, "--no-verify"], [...flags, "--include-business"],
  ]) assert.throws(() => parseFiveRecoveryArgs(injected));
  assert.throws(() => parseFiveRecoveryArgs(
    flags.map(x => x === SHA("d") ? "nope" : x),
  ), /FIVE_RECOVERY_PROD_OPERATOR_APPROVAL_INVALID/);
});

test("manifest SHA must be hash of exact reviewed bytes, not JSON normalized", () => {
  const bytes = Buffer.from(JSON.stringify(approval()), "utf8");
  const sha = createHash("sha256").update(bytes).digest("hex");
  assert.deepEqual(verifyFiveRecoveryManifestBytes(bytes, sha), parseFiveRecoveryManifest(approval()));
  assert.throws(() => verifyFiveRecoveryManifestBytes(bytes, SHA("d")),
    /FIVE_RECOVERY_MANIFEST_SHA256_MISMATCH/);
});

test("manifest must not include admin, unknown, fewer, duplicates or unordered IDs", () => {
  const base = approval();
  const permutations = [
    { ...base, entries: base.entries.slice(1) },
    { ...base, entries: [...base.entries].reverse() },
    { ...base, entries: base.entries.map(x => x) .slice(0, 4).concat(base.entries[3]) },
    { ...base, entries: base.entries.map((x, i) =>
      i === 0 ? { ...x, sourceRecordKey: "wordpress-db:user:1" } : x) },
    { ...base, entries: base.entries.map((x, i) =>
      i === 4 ? { ...x, sourceRecordKey: "wordpress-db:user:538" } : x) },
    { ...base, entries: base.entries.map((x, i) =>
      i === 2 ? { ...x, email: "private@example.org" } : x) },
    { ...base, sourceNamespace: "dev-user-recovery-1064" },
    { ...base, approvedBy: "ADMIN" },
    { ...base, approvedAt: "2999-01-01T00:00:00Z" },
    { ...base, passwordImported: true },
  ];
  for (const item of permutations) {
    assert.throws(() => parseFiveRecoveryManifest(item));
  }
});

test("plan and founder manifest must bind identity, source hash, canonical hash and no privileges", () => {
  const entry = parseFiveRecoveryManifest(approval()).entries[0];
  const draft = {
    role: "USER", status: "PENDING_ACTIVATION", passwordHash: null,
    emailVerifiedAt: null, phoneE164: null,
  };
  const plan = {
    sourceRecordKey: entry.sourceRecordKey, canonicalHash: entry.canonicalHash,
    candidate: { normalizedEmail: "account0@example.com" },
    action: "CREATE", draft,
  };
  assert.doesNotThrow(() => assertFiveRecoveryPlanApproved(entry, plan, entry.sourceHash));
  assert.doesNotThrow(() => assertFiveRecoveryPlanApproved(
    entry, { ...plan, action: "SKIP_UNCHANGED" }, entry.sourceHash,
  ));
  const invalid = [
    { ...plan, action: "UPDATE" },
    { ...plan, canonicalHash: SHA("e") },
    { ...plan, sourceRecordKey: "wordpress-db:user:538" },
    { ...plan, candidate: { normalizedEmail: "other@example.com" } },
    { ...plan, draft: { ...draft, role: "BUSINESS_OWNER" } },
    { ...plan, draft: { ...draft, status: "ACTIVE" } },
    { ...plan, draft: { ...draft, passwordHash: "stored-hash" } },
    { ...plan, draft: { ...draft, phoneE164: "+375291234567" } },
    { ...plan, draft: null },
  ];
  for (const item of invalid) {
    assert.throws(() => assertFiveRecoveryPlanApproved(
      entry, item, entry.sourceHash,
    ), /FIVE_RECOVERY_APPROVAL_MISMATCH/);
  }
  assert.throws(() => assertFiveRecoveryPlanApproved(entry, plan, SHA("f")),
    /FIVE_RECOVERY_APPROVAL_MISMATCH/);
});

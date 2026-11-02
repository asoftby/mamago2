import assert from "node:assert/strict";
import test from "node:test";

import { parseUserExclusionBackfillArgs } from "./migration-user-exclusion-backfill";

test("preview requires an explicit, non-write mode", () => {
  const args = parseUserExclusionBackfillArgs([
    "--preview", "--confirm-production",
  ]);
  assert.equal(args.mode, "PREVIEW");
  assert.equal(args.manifestPath, null);
  assert.throws(() => parseUserExclusionBackfillArgs([]));
  assert.throws(() => parseUserExclusionBackfillArgs(["--preview", "--confirm-writes"]));
});

test("production write refuses missing approval, reviewed hash and tested backup attestation", () => {
  assert.throws(
    () => parseUserExclusionBackfillArgs(["--confirm-writes", "--confirm-production"]),
    /PROD_BACKFILL_APPROVAL_AND_BACKUP_REQUIRED/,
  );
  const complete = [
    "--confirm-writes", "--confirm-production",
    "--acknowledge-prod-user-import",
    "--acknowledge-exclusion-backfill", "--confirm-backup-restored",
    "--backup-reference", "verified-test-restore",
    "--manifest", "/secure/approved.json",
    "--reviewed-manifest-sha256", "a".repeat(64),
  ];
  assert.equal(parseUserExclusionBackfillArgs(complete).mode, "COMMIT");
  for (const missing of [
    "--confirm-production", "--acknowledge-prod-user-import",
    "--acknowledge-exclusion-backfill", "--confirm-backup-restored",
  ]) {
    assert.throws(() => parseUserExclusionBackfillArgs(
      complete.filter(x => x !== missing),
    ), missing === "--confirm-production"
      ? /PROD_TARGET_CONFIRMATION_REQUIRED/
      : /PROD_BACKFILL_APPROVAL_AND_BACKUP_REQUIRED/);
  }
  assert.throws(() => parseUserExclusionBackfillArgs(
    complete.map(x => x === "a".repeat(64) ? "bad" : x),
  ), /PROD_BACKFILL_APPROVAL_AND_BACKUP_REQUIRED/);
});

test("unknown flags, absent values and attempts at arbitrary selection are refused", () => {
  assert.throws(() => parseUserExclusionBackfillArgs(["--preview", "--all-users"]), /Unknown argument/);
  assert.throws(() => parseUserExclusionBackfillArgs(["--preview", "--manifest"]), /Missing value/);
  assert.throws(() => parseUserExclusionBackfillArgs(["--preview", "--only", "43"]), /Unknown argument/);
  assert.throws(() => parseUserExclusionBackfillArgs(["--preview", "--allow-remote-readonly"]), /Unknown argument/);
  assert.throws(() => parseUserExclusionBackfillArgs(["--preview"]), /PROD_TARGET_CONFIRMATION_REQUIRED/);
});

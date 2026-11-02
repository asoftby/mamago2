import assert from "node:assert/strict";
import test from "node:test";

import {
  FIVE_WORDPRESS_SOURCE_KEYS,
  parseFiveUserSource,
  requirePreviewOnly,
} from "./migration-wordpress-five-preview";

const makeSource = () => ({
  archiveSha256: "a".repeat(64),
  sourceRecords: FIVE_WORDPRESS_SOURCE_KEYS.map((sourceRecordKey, index) => ({
    sourceRecordKey,
    email: "historic-" + index + "@example.org",
    displayName: "Historic WordPress user " + index,
  })),
});

test("five-user CLI refuses write flags, arbitrary scope and unconfirmed PROD", () => {
  assert.doesNotThrow(() =>
    requirePreviewOnly(["--preview", "--confirm-production"]));
  for (const args of [
    [],
    ["--preview"],
    ["--confirm-writes", "--confirm-production"],
    ["--preview", "--confirm-production", "--confirm-writes"],
    ["--preview", "--confirm-production", "--all"],
  ]) assert.throws(() => requirePreviewOnly(args), /READ_ONLY_FIVE_USER_PREVIEW_ONLY/);
});

test("strict source evidence contains exactly five known founder-excluded IDs", () => {
  const data = makeSource();
  assert.deepEqual(parseFiveUserSource(data), data);
  assert.equal(FIVE_WORDPRESS_SOURCE_KEYS.length, 5);
  assert.deepEqual([...FIVE_WORDPRESS_SOURCE_KEYS], [
    "wordpress-db:user:7",
    "wordpress-db:user:17",
    "wordpress-db:user:22",
    "wordpress-db:user:42",
    "wordpress-db:user:43",
  ]);
});

test("archive source shape and duplicate email safeguards fail closed", () => {
  const base = makeSource();
  const invalid = [
    { ...base, sourceRecords: base.sourceRecords.slice(1) },
    { ...base, archiveSha256: "not-a-hash" },
    { ...base, allowWrites: true },
    { ...base, sourceRecords: [...base.sourceRecords.slice(0, 4),
      { ...base.sourceRecords[4], sourceRecordKey: "wordpress-db:user:1" }] },
    { ...base, sourceRecords: [...base.sourceRecords.slice(0, 4),
      { ...base.sourceRecords[4], email: base.sourceRecords[3].email.toUpperCase() }] },
    { ...base, sourceRecords: [...base.sourceRecords.slice(0, 4),
      { ...base.sourceRecords[4], displayName: "" }] },
    { ...base, sourceRecords: [...base.sourceRecords.slice(0, 4),
      { ...base.sourceRecords[4], email: "invalid-email" }] },
    { ...base, sourceRecords: [...base.sourceRecords.slice(0, 4),
      { ...base.sourceRecords[4], isAdmin: true }] },
  ];
  for (const candidate of invalid) {
    assert.throws(() => parseFiveUserSource(candidate));
  }
});

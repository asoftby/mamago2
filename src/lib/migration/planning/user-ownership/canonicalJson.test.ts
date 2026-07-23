import assert from "node:assert/strict";
import test from "node:test";

import { bySourceRecordKey, canonicalHash, canonicalJsonString } from "./canonicalJson";

test("same input produces the same canonical hash", () => {
  const value = { b: 2, a: 1, list: [3, 1, 2] };
  assert.equal(canonicalHash(value), canonicalHash({ b: 2, a: 1, list: [3, 1, 2] }));
});

test("key order does not affect the canonical hash", () => {
  const a = { sourceRecordKey: "x", action: "EXACT_LINK_CANDIDATE", count: 3 };
  const b = { count: 3, action: "EXACT_LINK_CANDIDATE", sourceRecordKey: "x" };
  assert.equal(canonicalHash(a), canonicalHash(b));
});

test("shuffled entry order (sorted before hashing) produces the same hash", () => {
  const entries = [{ sourceRecordKey: "wordpress-db:user:2" }, { sourceRecordKey: "wordpress-db:user:1" }];
  const sortedA = [...entries].sort(bySourceRecordKey);
  const sortedB = [...entries].reverse().sort(bySourceRecordKey);
  assert.equal(canonicalHash(sortedA), canonicalHash(sortedB));
});

test("an evidence change produces a different hash", () => {
  const before = { sourceRecordKey: "wordpress-db:user:1", action: "EXACT_LINK_CANDIDATE" };
  const after = { sourceRecordKey: "wordpress-db:user:1", action: "MANUAL_REVIEW" };
  assert.notEqual(canonicalHash(before), canonicalHash(after));
});

test("canonical hash ignores fields that are never included, e.g. timestamps or local paths", () => {
  // The planners never put generatedAt/runId/absolute paths into hashed
  // payloads in the first place, so the same logical entry hashed twice
  // (as if produced by two different runs / machines) is identical.
  const runOne = { sourceRecordKey: "wordpress-db:user:1", action: "EXACT_LINK_CANDIDATE" };
  const runTwo = { sourceRecordKey: "wordpress-db:user:1", action: "EXACT_LINK_CANDIDATE" };
  assert.equal(canonicalJsonString(runOne), canonicalJsonString(runTwo));
});

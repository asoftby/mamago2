import assert from "node:assert/strict";
import test from "node:test";
import { loadNearbyOnlyWhenEmpty } from "./loadNearbyOnlyWhenEmpty";

test("local cards avoid all nearby work", async () => {
  let calls = 0;
  assert.deepEqual(await loadNearbyOnlyWhenEmpty(Promise.resolve([1]), async () => {
    calls++;
    return [2];
  }), []);
  assert.equal(calls, 0);
});

test("empty local section loads nearby cards exactly once", async () => {
  let calls = 0;
  assert.deepEqual(await loadNearbyOnlyWhenEmpty(Promise.resolve([]), async () => {
    calls++;
    return [2];
  }), [2]);
  assert.equal(calls, 1);
});

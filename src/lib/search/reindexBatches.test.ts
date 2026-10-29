import assert from "node:assert/strict";
import { walkSearchIndexIds } from "./reindexBatches";

async function testBoundedCursorTraversal() {
  const ids = Array.from({ length: 62 }, (_, i) => `id-${String(i).padStart(3, "0")}`);
  const visited: string[] = [];
  const cursors: Array<string | undefined> = [];
  let active = 0;
  let peakActive = 0;
  await walkSearchIndexIds(
    async (cursor) => {
      cursors.push(cursor);
      const start = cursor === undefined ? 0 : ids.indexOf(cursor) + 1;
      return ids.slice(start, start + 25).map((id) => ({ id }));
    },
    async (id) => {
      active++;
      peakActive = Math.max(peakActive, active);
      await Promise.resolve();
      visited.push(id);
      active--;
    },
  );
  assert.deepEqual([...visited].sort(), ids);
  assert.deepEqual(cursors, [undefined, ids[24], ids[49], ids[61]]);
  assert.ok(peakActive <= 25, "never processes more than one page concurrently");
}

async function testFailureStopsNextPage() {
  let calls = 0;
  await assert.rejects(
    walkSearchIndexIds(
      async () => { calls++; return [{ id: "broken" }]; },
      async () => { throw new Error("index failed"); },
    ),
    /index failed/,
  );
  assert.equal(calls, 1);
}

async function main() {
  await testBoundedCursorTraversal();
  await testFailureStopsNextPage();
  console.log("Search reindex batching tests: OK");
}
main().catch((error) => {
  console.error("Search reindex batching tests: FAILED", error);
  process.exitCode = 1;
});

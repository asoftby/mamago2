import assert from "node:assert/strict";
import { SearchIndexQueue } from "./SearchIndexQueue";

async function testDelayedEarlyWriteCannotBeatFinalWrite() {
  const queue = new SearchIndexQueue();
  const writes: string[] = [];
  let releaseEarly!: () => void;
  const earlyGate = new Promise<void>((resolve) => {
    releaseEarly = resolve;
  });

  const early = queue.enqueue("activity:1", async () => {
    await earlyGate;
    writes.push("id-based");
  });
  const final = queue.enqueue("activity:1", async () => {
    writes.push("slug-based");
  });

  await Promise.resolve();
  assert.deepEqual(writes, [], "final write must wait for the already-dispatched early write");
  releaseEarly();
  await Promise.all([early, final]);
  assert.deepEqual(writes, ["id-based", "slug-based"]);
}

async function testStrictCallerObservesIndexFailureAndRetryIsDeterministic() {
  const queue = new SearchIndexQueue();
  const failure = new Error("index unavailable");
  await assert.rejects(
    queue.enqueue("activity:2", async () => {
      throw failure;
    }),
    failure,
  );

  const writes: string[] = [];
  await queue.enqueue("activity:2", async () => {
    writes.push("slug-based");
  });
  await queue.enqueue("activity:2", async () => {
    writes.push("slug-based");
  });
  assert.deepEqual(writes, ["slug-based", "slug-based"]);
}

async function main() {
  await testDelayedEarlyWriteCannotBeatFinalWrite();
  await testStrictCallerObservesIndexFailureAndRetryIsDeterministic();
  console.log("SearchIndexQueue tests: OK");
}

main().catch((error) => {
  console.error("SearchIndexQueue tests: FAILED", error);
  process.exitCode = 1;
});

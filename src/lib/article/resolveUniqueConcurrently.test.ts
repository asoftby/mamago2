import assert from "node:assert/strict";
import { resolveUniqueConcurrently } from "./resolveUniqueConcurrently";

type Offer = { id: string; blockId: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function testEarlyLaterRejectionIsHandledAndPropagated() {
  const first = deferred<string>();
  const second = deferred<string>();
  const unexpectedUnhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unexpectedUnhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);

  try {
    const result = resolveUniqueConcurrently(
      [{ id: "first", blockId: "1" }, { id: "second", blockId: "2" }],
      (offer) => offer.id,
      (offer) => offer.id === "first" ? first.promise : second.promise,
    );
    const failure = new Error("later offer failed first");
    const propagatedFailure = assert.rejects(result, failure);
    second.reject(failure);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(unexpectedUnhandled, [], "every eager resolver must have a rejection handler immediately");
    first.resolve("first card");
    await propagatedFailure;
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
}

async function testDedupParallelismAndStableOrder() {
  const first = deferred<string>();
  const second = deferred<string>();
  const calls: string[] = [];
  const result = resolveUniqueConcurrently<Offer, string>(
    [
      { id: "first", blockId: "1" },
      { id: "second", blockId: "2" },
      { id: "first", blockId: "3" },
    ],
    (offer) => offer.id,
    (offer) => {
      calls.push(offer.id);
      return offer.id === "first" ? first.promise : second.promise;
    },
  );

  assert.deepEqual(calls, ["first", "second"], "distinct resolvers start synchronously and duplicates run once");
  second.resolve("second card");
  await new Promise<void>((resolve) => setImmediate(resolve));
  first.resolve("first card");

  const cards = await result;
  assert.deepEqual([...cards], [["first", "first card"], ["second", "second card"]], "result map preserves first-reference order");
}

async function main() {
  await testEarlyLaterRejectionIsHandledAndPropagated();
  await testDedupParallelismAndStableOrder();
  console.log("resolveUniqueConcurrently.test.ts: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

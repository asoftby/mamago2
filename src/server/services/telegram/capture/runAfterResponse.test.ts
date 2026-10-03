import assert from "node:assert/strict";
import test from "node:test";
import { runAfterResponse } from "./runAfterResponse";

test("schedules the task through the provided scheduler without running it inline", async () => {
  const scheduled: Array<() => Promise<void>> = [];
  let ran = false;
  runAfterResponse(
    async () => {
      ran = true;
    },
    (task) => scheduled.push(task),
  );
  assert.equal(scheduled.length, 1);
  assert.equal(ran, false);
  await scheduled[0]!();
  assert.equal(ran, true);
});

test("a failing task is swallowed and logged as a code only", async () => {
  const logs: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  try {
    const scheduled: Array<() => Promise<void>> = [];
    runAfterResponse(
      async () => {
        throw new Error("secret message text");
      },
      (task) => scheduled.push(task),
    );
    await scheduled[0]!();
  } finally {
    console.error = original;
  }
  assert.deepEqual(logs, ["[telegram:capture] code=AFTER_RESPONSE_TASK_FAILED"]);
});

test("when the scheduler throws, falls back to fire-and-forget and still runs the task", async () => {
  let ran = false;
  runAfterResponse(
    async () => {
      ran = true;
    },
    () => {
      throw new Error("after() called outside a request scope");
    },
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(ran, true);
});

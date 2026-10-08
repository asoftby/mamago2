import assert from "node:assert/strict";
import test from "node:test";
import { executePipelinePendingAction } from "./pipeline";

test("callback-backed pending action executes once", async () => {
  let calls = 0;
  const executed = await executePipelinePendingAction({
    storedAction: null,
    executor: async () => {
      calls += 1;
    },
  });
  assert.equal(executed, true);
  assert.equal(calls, 1);
});

test("callback-backed pending action remains fail-closed", async () => {
  await assert.rejects(
    executePipelinePendingAction({
      storedAction: null,
      executor: async () => {
        throw new Error("save failed");
      },
    }),
    /save failed/,
  );
});

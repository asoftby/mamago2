import assert from "node:assert/strict";
import test from "node:test";
import { draft, entry } from "./captureDraft.testkit";
import { applyOwnerCorrection, parseOwnerOnlyCorrection, retainTargetRules } from "./captureEditTarget";

test("typed correction «Не Степан, а Я Лёша» is deterministic self-assignment", () => {
  assert.equal(parseOwnerOnlyCorrection("Не Степан, а Я Лёша"), "me");
  assert.equal(parseOwnerOnlyCorrection("это для меня"), "me");
  assert.equal(parseOwnerOnlyCorrection("не для Степана, а для всех"), "all");
  assert.equal(parseOwnerOnlyCorrection("перенеси на 19:00"), null);
});

test("self correction clears incorrectly inferred child without touching date or place", () => {
  const previous = draft({ entries: [entry({ child: { childId: "stepan", raw: "Степан", state: "inferred" } })] });
  const result = applyOwnerCorrection(previous, "me");
  assert.equal(result.ruleCode, "CAPTURE_TARGET_ME");
  assert.equal(result.draft.entries[0]?.child.childId, null);
  assert.equal(result.draft.entries[0]?.child.state, "missing");
  assert.equal(result.draft.entries[0]?.startsAt.value, previous.entries[0]?.startsAt.value);
  assert.equal(previous.entries[0]?.child.childId, "stepan");
  assert.deepEqual(retainTargetRules(["ALBUM_TRUNCATED", "CAPTURE_TARGET_CHILD"]), ["CAPTURE_TARGET_CHILD"]);
});

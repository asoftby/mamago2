import assert from "node:assert/strict";
import test from "node:test";
import { draft, entry } from "./captureDraft.testkit";
import { applyOwnerCorrection, parseOwnerOnlyCorrection, reconcileEditedTarget, retainTargetRules } from "./captureEditTarget";

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


test("editing a selected adult to «это для Стёпы» changes target to child and preserves date", () => {
  const previous = draft();
  const updated = draft({ entries: [
    entry({ child: { childId: "stepan", raw: "Стёпа", state: "stated" } }),
  ] });
  const result = reconcileEditedTarget({
    previous, updated, previousRules: ["CAPTURE_TARGET_ME"], instruction: "это для Стёпы",
  });
  assert.deepEqual(result.targetRules, ["CAPTURE_TARGET_CHILD"]);
  assert.equal(result.draft.entries[0]?.child.childId, "stepan");
  assert.equal(result.draft.entries[0]?.startsAt.value, previous.entries[0]?.startsAt.value);
});

test("editing a whole-family item to a child switches target", () => {
  const previous = draft();
  const updated = draft({ entries: [
    entry({ child: { childId: "stepan", raw: "Стёпа", state: "stated" } }),
  ] });
  const result = reconcileEditedTarget({
    previous, updated, previousRules: ["CAPTURE_TARGET_ALL"], instruction: "для Стёпы",
  });
  assert.deepEqual(result.targetRules, ["CAPTURE_TARGET_CHILD"]);
  assert.equal(result.draft.entries[0]?.child.childId, "stepan");
});

test("a time correction cannot silently reassign a selected adult even if the model invents child", () => {
  const previous = draft();
  const updated = draft({ entries: [
    entry({ child: { childId: "stepan", raw: null, state: "inferred" } }),
  ] });
  const result = reconcileEditedTarget({
    previous, updated, previousRules: ["CAPTURE_TARGET_ME"], instruction: "перенеси на 19:00",
  });
  assert.deepEqual(result.targetRules, ["CAPTURE_TARGET_ME"]);
  assert.equal(result.draft.entries[0]?.child.childId, null);
});

test("a date change preserves an explicitly selected child if model drops the child field", () => {
  const previous = draft({ entries: [
    entry({ child: { childId: "stepan", raw: "Стёпа", state: "stated" } }),
  ] });
  const updated = draft();
  const result = reconcileEditedTarget({
    previous, updated, previousRules: ["CAPTURE_TARGET_CHILD"], instruction: "перенеси на 19:00",
  });
  assert.deepEqual(result.targetRules, ["CAPTURE_TARGET_CHILD"]);
  assert.equal(result.draft.entries[0]?.child.childId, "stepan");
});

test("no implicit assignment for unrelated edit without an explicit selection", () => {
  const result = reconcileEditedTarget({
    previous: draft(), updated: draft(), previousRules: [], instruction: "перенеси на 19:00",
  });
  assert.deepEqual(result.targetRules, []);
});

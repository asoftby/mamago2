import assert from "node:assert/strict";
import {
  mergeInterestsText,
  mergedPlanVisibility,
  normalizeChildName,
  suggestChildMatches,
  validateMergeDecision,
} from "./familyMergePure";

const d = (y: number) => new Date(Date.UTC(y, 5, 1));

assert.equal(normalizeChildName("  Ёжик  Петров "), "ежик петров");

const sug = suggestChildMatches(
  [
    { id: "j1", name: "Степа", birthDate: d(2020) },
    { id: "j2", name: "Маша", birthDate: d(2018) },
    { id: "j3", name: "Степа", birthDate: d(2020) },
    { id: "j4", name: null, birthDate: null },
  ],
  [
    { id: "t1", name: "степа ", birthDate: d(2020) },
    { id: "t2", name: "Маша", birthDate: d(2019) },
  ],
);
assert.equal(sug.get("j1"), "t1");
assert.equal(sug.get("j2"), null, "different birth year is not suggested");
assert.equal(sug.get("j3"), null, "a target child is suggested once");
assert.equal(sug.get("j4"), null);

const ok = { plan: "PRIVATE" as const, children: [{ childId: "a", action: "SAME" as const, targetChildId: "t" }, { childId: "b", action: "SKIP" as const }] };
assert.equal(validateMergeDecision(["a", "b"], ["t"], ok), null);
assert.match(validateMergeDecision(["a", "b", "c"], ["t"], ok) ?? "", /every child/);
assert.match(validateMergeDecision(["a"], ["t"], ok) ?? "", /unknown child/);
assert.match(validateMergeDecision(["a", "b"], ["x"], ok) ?? "", /unknown target/);
assert.match(
  validateMergeDecision(["a", "b"], ["t"], { plan: "PRIVATE", children: [{ childId: "a", action: "SAME", targetChildId: "t" }, { childId: "b", action: "SAME", targetChildId: "t" }] }) ?? "",
  /used twice/,
);
assert.match(validateMergeDecision(["a"], [], { plan: "PRIVATE", children: [{ childId: "a", action: "ADD" }, { childId: "a", action: "SKIP" }] }) ?? "", /twice/);
assert.equal(validateMergeDecision([], [], { plan: "SKIP", children: [] }), null);

assert.equal(mergeInterestsText("Плавание, Рисование", "рисование, Футбол"), "Плавание, Рисование, Футбол");
assert.equal(mergeInterestsText(null, null), null);

assert.equal(mergedPlanVisibility("PRIVATE", { activityId: "x" }, new Set()), "PRIVATE");
assert.equal(mergedPlanVisibility("FAMILY", { activityId: "x" }, new Set(["x"])), "PRIVATE");
assert.equal(mergedPlanVisibility("FAMILY", { activityId: "y" }, new Set(["x"])), "FAMILY");
assert.equal(mergedPlanVisibility("FAMILY", { activityId: null }, new Set(["x"])), "FAMILY");
console.log("familyMerge.test: ok");

import assert from "node:assert/strict";
import { initialMergeDecision, inviterTitle, joinErrorMessage, needsMergeStep, type JoinPreview } from "./familyJoinView";

const empty: JoinPreview = { joinerChildren: [], targetChildren: [], suggestions: {}, planItemCount: 0 };
assert.equal(needsMergeStep(empty), false);
assert.equal(needsMergeStep({ ...empty, planItemCount: 2 }), true);
assert.equal(needsMergeStep({ ...empty, joinerChildren: [{ id: "c", name: "A", birthYear: 2020 }] }), true);

const p: JoinPreview = {
  joinerChildren: [
    { id: "j1", name: "Маша", birthYear: 2020 },
    { id: "j2", name: "Маша", birthYear: 2020 },
    { id: "j3", name: "Петя", birthYear: 2018 },
  ],
  targetChildren: [{ id: "t1", name: "Маша", birthYear: 2020 }],
  suggestions: { j1: "t1", j2: "t1", j3: null },
  planItemCount: 3,
};
const d = initialMergeDecision(p);
assert.equal(d.plan, "PRIVATE", "plan defaults to private");
assert.deepEqual(d.children[0], { childId: "j1", action: "SAME", targetChildId: "t1" });
assert.deepEqual(d.children[1], { childId: "j2", action: "ADD" }, "a target child is never used twice");
assert.deepEqual(d.children[2], { childId: "j3", action: "ADD" });

assert.match(joinErrorMessage("has_other_adults"), /выйдите/);
assert.match(joinErrorMessage("zzz"), /Не получилось/);
assert.equal(inviterTitle("Алексей"), "Алексей приглашает вас в семью");
assert.equal(inviterTitle(null), "Вас приглашают в семью");
console.log("familyJoinView.test: ok");

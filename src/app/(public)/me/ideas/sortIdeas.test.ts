import assert from "node:assert/strict";
import { sortIdeasPastLast } from "./sortIdeas";
import type { IdeaItem } from "./types";

function idea(id: string, past: boolean, createdAt: string): IdeaItem {
  return {
    id, ideaType: "ACTIVITY", createdAt, isPlanned: false, planStatus: "NONE",
    activity: { id, title: id, type: "EVENT", temporalState: past ? "PAST" : "UPCOMING" },
  } as IdeaItem;
}
const original = [
  idea("oldPast", true, "2026-10-17"),
  idea("activeOld", false, "2026-10-15"),
  idea("newPast", true, "2026-10-19"),
  idea("activeNew", false, "2026-10-18"),
];
const sorted = sortIdeasPastLast(original);
assert.deepEqual(sorted.map((item) => item.id), ["activeNew", "activeOld", "newPast", "oldPast"]);
assert.equal(original[0].id, "oldPast", "input should not mutate");
console.log("sortIdeasPastLast: OK");

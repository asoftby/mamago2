import assert from "node:assert/strict";
import { filterPlanEntriesByPerson } from "./filterPlanEntriesByPerson";

const entries = [
  { id: "mine", childId: null, assigneeUserId: "adult-1", authorId: "adult-2" },
  { id: "other", childId: null, assigneeUserId: "adult-2", authorId: "adult-1" },
  { id: "unassigned", childId: null, assigneeUserId: null, authorId: "adult-1" },
  { id: "child", childId: "child-1", assigneeUserId: null, authorId: "adult-1" },
];
assert.deepEqual(filterPlanEntriesByPerson(entries, { kind: "all" }).map((x) => x.id), ["mine", "other", "unassigned", "child"]);
assert.deepEqual(filterPlanEntriesByPerson(entries, { kind: "adult", id: "adult-1" }).map((x) => x.id), ["mine"]);
assert.deepEqual(filterPlanEntriesByPerson(entries, { kind: "child", id: "child-1" }).map((x) => x.id), ["child"]);
console.log("filterPlanEntriesByPerson: OK");

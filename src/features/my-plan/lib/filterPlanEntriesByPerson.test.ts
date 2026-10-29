import assert from "node:assert/strict";
import { filterPlanEntriesByPerson, filterVisiblePlanEntries } from "./filterPlanEntriesByPerson";

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


const visible = [
  { id: "one", assigneeUserId: "adult-1", childId: null, visibility: "PRIVATE" as const },
  { id: "two", assigneeUserId: "adult-2", childId: null, visibility: "FAMILY" as const },
  { id: "three", assigneeUserId: null, childId: "child-1", visibility: "FAMILY" as const },
  { id: "shared", assigneeUserId: "adult-1", childId: null, visibility: "FAMILY" as const },
];
assert.deepEqual(filterVisiblePlanEntries(visible, { include: [{kind:"adult",id:"adult-1"},{kind:"child",id:"child-1"}] }).map(x=>x.id), ["one","three","shared"]);
assert.deepEqual(filterVisiblePlanEntries(visible, { include: [{kind:"all"}], exclude: [{kind:"adult",id:"adult-2"}], visibility:"FAMILY" }).map(x=>x.id), ["three","shared"]);
assert.deepEqual(filterVisiblePlanEntries(visible, { include: [], visibility:"PRIVATE" }).map(x=>x.id), ["one"]);
assert.equal(filterVisiblePlanEntries(visible, { include: [{kind:"adult",id:"adult-1"},{kind:"adult",id:"adult-1"}] }).length, 2);

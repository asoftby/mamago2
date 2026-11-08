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

assert.deepEqual(
  filterVisiblePlanEntries(visible, { include: [{ kind: "adult", id: "departed-adult" }] }),
  [],
  "stale participant selection must not broaden to the whole family",
);
assert.deepEqual(
  filterVisiblePlanEntries(visible, {
    include: [{ kind: "adult", id: "adult-1" }],
    exclude: [{ kind: "adult", id: "adult-1" }],
  }),
  [],
  "explicit exclusion wins over inclusion",
);

const programme = [{ id: "party", childId: "child-1", assigneeUserId: null,
  partyOrder: { id: "order", programmeAdultIds: ["adult-2"], programmeChildIds: ["child-1", "child-2"] } }];
assert.equal(filterPlanEntriesByPerson(programme, { kind: "child", id: "child-2" }).length, 1);
assert.equal(filterVisiblePlanEntries(programme, { include: [{ kind: "adult", id: "adult-2" }] }).length, 1);
assert.equal(filterVisiblePlanEntries(programme, { include: [{ kind: "adult", id: "adult-1" }] }).length, 0,
  "ownership alone is not attendance");
assert.equal(filterVisiblePlanEntries(programme, { include: [{ kind: "all" }], exclude: [{ kind: "child", id: "child-2" }] }).length, 0);

import assert from "node:assert/strict";
import test from "node:test";

import { fanOutItemsToDigestTargets, fanOutItemsToFamilyMembers } from "./planRecipients";

const members = new Map([["f1", ["a", "b"]]]);

test("reminders: FAMILY item goes to every active adult once", () => {
  const out = fanOutItemsToFamilyMembers(
    [{ id: "i1", userId: "a", familyId: "f1", visibility: "FAMILY" as const }],
    members,
  );
  assert.deepEqual(out.map((i) => i.userId).sort(), ["a", "b"]);
});

test("reminders: PRIVATE item stays with its author, family-less item too", () => {
  const out = fanOutItemsToFamilyMembers(
    [
      { id: "p", userId: "a", familyId: "f1", visibility: "PRIVATE" as const },
      { id: "l", userId: "z", familyId: null, visibility: "FAMILY" as const },
    ],
    members,
  );
  assert.deepEqual(out.map((i) => [i.id, i.userId]), [["p", "a"], ["l", "z"]]);
});

test("reminders: duplicate member ids do not duplicate notifications", () => {
  const out = fanOutItemsToFamilyMembers(
    [{ userId: "a", familyId: "f1", visibility: "FAMILY" as const }],
    new Map([["f1", ["a", "b", "b"]]]),
  );
  assert.equal(out.length, 2);
});

test("digests: both adults get the family item for their own target; PRIVATE only the author", () => {
  const items = [
    { id: "fam", userId: "a", familyId: "f1", visibility: "FAMILY" as const, date: "2026-11-01" },
    { id: "prv", userId: "a", familyId: "f1", visibility: "PRIVATE" as const, date: "2026-11-01" },
    { id: "other-day", userId: "a", familyId: "f1", visibility: "FAMILY" as const, date: "2026-11-02" },
  ];
  const targets = [
    { userId: "a", date: "2026-11-01", familyId: "f1" },
    { userId: "b", date: "2026-11-01", familyId: "f1" },
  ];
  const out = fanOutItemsToDigestTargets(items, targets).map((i) => `${i.userId}:${i.id}`).sort();
  assert.deepEqual(out, ["a:fam", "a:prv", "b:fam"]);
});

test("digests: other family and legacy author-only targets", () => {
  const items = [
    { id: "x", userId: "a", familyId: "f1", visibility: "FAMILY" as const, date: "d" },
    { id: "leg", userId: "c", familyId: null, visibility: "FAMILY" as const, date: "d" },
  ];
  const out = fanOutItemsToDigestTargets(items, [
    { userId: "z", date: "d", familyId: "f2" },
    { userId: "c", date: "d", familyId: null },
  ]);
  assert.deepEqual(out.map((i) => `${i.userId}:${i.id}`), ["c:leg"]);
});

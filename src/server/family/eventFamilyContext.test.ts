import assert from "node:assert/strict";
import test from "node:test";
import { FAMILY_EVENT_TYPES, resolveEventFamilyId } from "./eventFamilyContext";

const lookup = async (userId: string) => (userId === "u1" ? "fam1" : null);

test("family events resolve the active family", async () => {
  for (const eventType of FAMILY_EVENT_TYPES) {
    assert.equal(await resolveEventFamilyId({ eventType, userId: "u1" }, lookup), "fam1");
  }
});

test("explicit familyId (including null) wins and skips the lookup", async () => {
  const boom = async () => {
    throw new Error("lookup must not run");
  };
  assert.equal(await resolveEventFamilyId({ eventType: "PLAN_ADD", userId: "u1", familyId: "x" }, boom), "x");
  assert.equal(await resolveEventFamilyId({ eventType: "PLAN_ADD", userId: "u1", familyId: null }, boom), null);
});

test("non-family events, guests and users without a family stay family-less", async () => {
  assert.equal(await resolveEventFamilyId({ eventType: "PAGE_VIEW", userId: "u1" }, lookup), null);
  assert.equal(await resolveEventFamilyId({ eventType: "PLAN_ADD" }, lookup), null);
  assert.equal(await resolveEventFamilyId({ eventType: "PLAN_ADD", userId: "u2" }, lookup), null);
});

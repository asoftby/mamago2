import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bookingUnitCreateSchema } from "./bookingUnitInput";

const base = {
  name: "Комната №1", capacity: 12, prepMinutes: 30, cleanupMinutes: 30,
  minDurationMinutes: 60, stepMinutes: 30, offerIds: ["offer-1"],
  rules: [{ weekday: 2, startMinutes: 600, endMinutes: 1080 }],
};
assert.equal(bookingUnitCreateSchema.safeParse(base).success, true);
assert.equal(bookingUnitCreateSchema.safeParse({ ...base, offerIds: ["x", "x"] }).success, false);
assert.equal(bookingUnitCreateSchema.safeParse({ ...base, rules: [
  { weekday: 2, startMinutes: 600, endMinutes: 840 },
  { weekday: 2, startMinutes: 830, endMinutes: 1080 },
] }).success, false);
assert.equal(bookingUnitCreateSchema.safeParse({ ...base, rules: [
  { weekday: 2, startMinutes: 600, endMinutes: 840 },
  { weekday: 2, startMinutes: 840, endMinutes: 1080 },
] }).success, true);
assert.equal(bookingUnitCreateSchema.safeParse({ ...base, rules: [{ weekday: 2, startMinutes: 900, endMinutes: 600 }] }).success, false);
const api = readFileSync("src/app/api/business/booking-units/route.ts", "utf8");
for (const token of [
  "getCurrentUser()", "getMyBusiness(user.id)", 'operationalStatus !== "ACTIVE"',
  "businessId: access.business!.id", "id: { in: offerIds }, businessId",
  "bookingUnitCreateSchema.safeParse(body)", "rules: { create: rules }",
]) assert.ok(api.includes(token), "Missing isolation or validation guard: " + token);
console.log("bookingUnitInput.test.ts: OK");

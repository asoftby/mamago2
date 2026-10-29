import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bookingUnitUpdateSchema } from "./bookingUnitInput";

const base = {
  name: "Комната №1", capacity: 12, prepMinutes: 30, cleanupMinutes: 30,
  minDurationMinutes: 60, stepMinutes: 30, offerIds: ["offer-1"],
  rules: [{ weekday: 2, startMinutes: 600, endMinutes: 1080 }],
  expectedUpdatedAt: "2026-10-28T12:00:00.000Z", status: "ACTIVE",
  exceptions: [
    { date: "2026-11-10", kind: "CLOSED", startMinutes: null, endMinutes: null },
    { date: "2026-11-11", kind: "OPEN_OVERRIDE", startMinutes: 600, endMinutes: 900 },
  ],
};
assert.equal(bookingUnitUpdateSchema.safeParse(base).success, true);
assert.equal(bookingUnitUpdateSchema.safeParse({ ...base, exceptions: [
  { date: "2026-11-10", kind: "CLOSED", startMinutes: 600, endMinutes: 900 },
  { date: "2026-11-10", kind: "OPEN_OVERRIDE", startMinutes: 800, endMinutes: 1000 },
] }).success, false, "overlapping exceptions cannot conflict");
assert.equal(bookingUnitUpdateSchema.safeParse({ ...base, exceptions: [
  { date: "2026-11-10", kind: "CLOSED", startMinutes: 600, endMinutes: 900 },
  { date: "2026-11-10", kind: "OPEN_OVERRIDE", startMinutes: 900, endMinutes: 1000 },
] }).success, true, "adjacent exceptions are allowed");
assert.equal(bookingUnitUpdateSchema.safeParse({ ...base, exceptions: [
  { date: "2026-02-30", kind: "CLOSED", startMinutes: null, endMinutes: null },
] }).success, false, "must reject impossible dates");
assert.equal(bookingUnitUpdateSchema.safeParse({ ...base, exceptions: [
  { date: "2026-11-10", kind: "CLOSED", startMinutes: 850, endMinutes: 800 },
] }).success, false, "must reject inverted time");
assert.equal(bookingUnitUpdateSchema.safeParse({ ...base, exceptions: [
  { date: "2026-11-10", kind: "CLOSED", startMinutes: 850, endMinutes: null },
] }).success, false, "must reject half-specified time");
assert.equal(bookingUnitUpdateSchema.safeParse({ ...base, rules: [
  { weekday: 2, startMinutes: 600, endMinutes: 800 },
  { weekday: 2, startMinutes: 790, endMinutes: 1080 },
] }).success, false, "must preserve create-time slot overlap validation");
assert.equal(bookingUnitUpdateSchema.safeParse({ ...base, offerIds: ["offer-1", "offer-1"] }).success, false);
assert.equal(bookingUnitUpdateSchema.safeParse({ ...base, expectedUpdatedAt: "yesterday" }).success, false);

const route = readFileSync("src/app/api/business/booking-units/[id]/route.ts", "utf8");
for (const check of [
  'getMyBusiness(user.id)',
  'where: { id, businessId }',
  'FOR UPDATE',
  'current.updatedAt.toISOString() !== expectedUpdatedAt',
  'blockEnd: { gt: now }',
  '{ status: "CONFIRMED" }',
  '{ status: "HELD", expiresAt: { gt: now } }',
  'if (occupied > 0)',
  'place: { ownerBusinessId: businessId }',
  'tx.bookingUnitOffer.deleteMany',
  'tx.availabilityRule.deleteMany',
  'tx.availabilityException.deleteMany',
  'tx.bookingUnit.update',
]) assert.ok(route.includes(check), "Missing booking-safety contract: " + check);
const lock = route.indexOf("FOR UPDATE");
const occupation = route.indexOf("const occupied = ");
const mutation = route.indexOf("tx.bookingUnitOffer.deleteMany");
assert.ok(lock >= 0 && occupation > lock && mutation > occupation,
  "must acquire canonical resource lock and check existing bookings before editing");
console.log("bookingUnitUpdate.test.ts: OK");

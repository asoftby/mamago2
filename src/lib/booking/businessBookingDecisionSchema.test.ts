import assert from "node:assert/strict";
import { businessBookingDecisionSchema, businessRejectionReasons } from "./businessBookingDecisionSchema";
for (const status of ["REJECTED", "CANCELLED"]) {
  assert.equal(businessBookingDecisionSchema.safeParse({ status }).success, false);
  for (const reason of businessRejectionReasons.slice(0, -1)) {
    assert.equal(businessBookingDecisionSchema.safeParse({ status, reason }).success, true);
  }
  assert.equal(businessBookingDecisionSchema.safeParse({ status, reason: "Другая причина", comment: " " }).success, false);
  assert.equal(businessBookingDecisionSchema.safeParse({ status, reason: "Другая причина", comment: "Изменились условия" }).success, true);
  assert.equal(businessBookingDecisionSchema.safeParse({ status, reason: "Нет свободных мест", comment: "x".repeat(501) }).success, false);
}
assert.equal(businessBookingDecisionSchema.safeParse({ status: "CONFIRMED" }).success, true);
console.log("Business decision reason schema: PASS");

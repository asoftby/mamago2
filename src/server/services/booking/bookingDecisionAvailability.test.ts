import assert from "node:assert/strict";
import { test } from "node:test";
import { assessCurrentEventBookingCapacity } from "./bookingDecisionAvailability.service";

const shared = { mode: "ALL" as const, adultsCapacity: null, childrenCapacity: null };
const children = { mode: "CHILDREN" as const, adultsCapacity: null, childrenCapacity: null };
const separate = { mode: "SEPARATE" as const, adultsCapacity: 1, childrenCapacity: 2 };

test("pending request holds the final seat; remaining zero is still confirmable", () => {
  const result = assessCurrentEventBookingCapacity({
    policy: shared, capacity: 3, usedAdults: 1, usedChildren: 2,
    requestAdults: 1, requestChildren: 2,
  });
  assert.equal(result.remaining, 0);
  assert.equal(result.canConfirm, true);
});
test("capacity reduced below currently held bookings blocks confirmation", () => {
  const result = assessCurrentEventBookingCapacity({
    policy: shared, capacity: 2, usedAdults: 1, usedChildren: 2,
    requestAdults: 1, requestChildren: 2,
  });
  assert.equal(result.canConfirm, false);
  assert.equal(result.code, "FULL");
});
test("child seats do not count accompanying adults", () => {
  const result = assessCurrentEventBookingCapacity({
    policy: children, capacity: 2, usedAdults: 3, usedChildren: 2,
    requestAdults: 1, requestChildren: 1,
  });
  assert.equal(result.canConfirm, true);
});
test("separate adult/child quotas are assessed independently", () => {
  assert.equal(assessCurrentEventBookingCapacity({
    policy: separate, capacity: null, usedAdults: 2, usedChildren: 1,
    requestAdults: 1, requestChildren: 1,
  }).canConfirm, false);
  assert.equal(assessCurrentEventBookingCapacity({
    policy: separate, capacity: null, usedAdults: 1, usedChildren: 2,
    requestAdults: 1, requestChildren: 2,
  }).canConfirm, true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { BookingAllocationStatus as A, BookingStatus as B } from "@prisma/client";
import { allocationTransition } from "./allocationTransition";

const now = new Date("2026-10-27T12:00:00.000Z");
const held = (expiresAt: Date | null) => [{ status: A.HELD, expiresAt }];

test("active hold is promoted on confirmation", () => {
  assert.equal(allocationTransition(B.CONFIRMED, held(new Date(now.getTime() + 60_000)), now), A.CONFIRMED);
});

test("hold expiring exactly now cannot be confirmed", () => {
  assert.throws(() => allocationTransition(B.CONFIRMED, held(now), now), /Резерв истёк/);
});

test("expired hold cannot be confirmed", () => {
  assert.throws(() => allocationTransition(B.CONFIRMED, held(new Date(now.getTime() - 1)), now), /Резерв истёк/);
});

test("released and expired allocations cannot be revived", () => {
  for (const status of [A.RELEASED, A.EXPIRED]) {
    assert.throws(() => allocationTransition(B.CONFIRMED, [{ status, expiresAt: null }], now), /Резерв истёк/);
  }
});

test("already confirmed allocation remains confirmed", () => {
  assert.equal(allocationTransition(B.CONFIRMED, [{ status: A.CONFIRMED, expiresAt: null }], now), A.CONFIRMED);
});

test("rejection releases both held and confirmed allocations", () => {
  for (const status of [A.HELD, A.CONFIRMED]) {
    assert.equal(allocationTransition(B.REJECTED, [{ status, expiresAt: null }], now), A.RELEASED);
  }
});

test("completion leaves confirmed allocation intact", () => {
  assert.equal(allocationTransition(B.COMPLETED, [{ status: A.CONFIRMED, expiresAt: null }], now), null);
});

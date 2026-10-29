import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { slotIntentHash, slotKeyLock, validSlotKey } from "./slotIdempotency";

const booking = {
  offerId: "offer-1",
  classGroupId: "group-1",
  startsAt: new Date("2026-11-05T15:00:00.000Z"),
  endsAt: new Date("2026-11-05T16:00:00.000Z"),
  selectedOptionIds: ["second", "first"],
  seats: 2,
  customerName: "Customer",
  customerPhone: "+375291112233",
};
test("per-intent hashes are stable across equivalent optional extras", () => {
  const hash = slotIntentHash(booking);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, slotIntentHash({ ...booking, selectedOptionIds: ["first", "second"] }));
  assert.notEqual(hash, slotIntentHash({ ...booking, seats: 1 }));
  assert.notEqual(hash, slotIntentHash({ ...booking, childId: "child-A" }));
  assert.notEqual(hash, slotIntentHash({ ...booking, userId: "another-user" }));
  assert.notEqual(hash, slotIntentHash({ ...booking, startsAt: new Date("2026-11-06T15:00:00Z") }));
});
test("per-offer advisory lock namespaces even the same client UUID", () => {
  const key = randomUUID();
  assert.ok(validSlotKey(key));
  assert.equal(slotKeyLock("offer-1", key), slotKeyLock("offer-1", key));
  assert.notEqual(slotKeyLock("offer-2", key), slotKeyLock("offer-1", key));
  assert.equal(typeof slotKeyLock("offer-1", key), "bigint");
});
test("only UUID-like strings can reserve an idempotent slot", () => {
  assert.equal(validSlotKey("guessable"), false);
  assert.equal(validSlotKey(""), false);
  assert.equal(validSlotKey(randomUUID()), true);
});

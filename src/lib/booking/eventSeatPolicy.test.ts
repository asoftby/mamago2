import assert from "node:assert/strict";
import { calculateEventSeatAvailability, getEventSeatError, getEventSeatPolicy, occupiedEventSeats } from "./eventSeatPolicy";

assert.deepEqual(getEventSeatPolicy(null), { mode: "ALL", adultsCapacity: null, childrenCapacity: null });
assert.equal(getEventSeatPolicy({ eventSeatMode: "unknown" }).mode, "ALL");
assert.equal(occupiedEventSeats("ALL", 1, 2), 3);
assert.equal(occupiedEventSeats("CHILDREN", 1, 2), 2);
assert.equal(occupiedEventSeats("ADULTS", 1, 2), 1);
const total = calculateEventSeatAvailability({ policy: getEventSeatPolicy(null), capacity: 2, usedAdults: 0, usedChildren: 0 });
assert.deepEqual(total, { capacity: 2, remaining: 2 });
assert.ok(getEventSeatError(total, 1, 2, "ALL")?.includes("Нужно: 3"));
const kids = calculateEventSeatAvailability({ policy: getEventSeatPolicy({ eventSeatMode: "CHILDREN" }), capacity: 2, usedAdults: 2, usedChildren: 0 });
assert.deepEqual(kids, { mode: "CHILDREN", capacity: 2, remaining: 2 });
assert.equal(getEventSeatError(kids, 1, 2, "CHILDREN"), null);
assert.ok(getEventSeatError(kids, 1, 3, "CHILDREN"));
const adults = calculateEventSeatAvailability({ policy: getEventSeatPolicy({ eventSeatMode: "ADULTS" }), capacity: 2, usedAdults: 1, usedChildren: 3 });
assert.deepEqual(adults, { mode: "ADULTS", capacity: 2, remaining: 1 });
assert.equal(getEventSeatError(adults, 1, 2, "ADULTS"), null);
const split = calculateEventSeatAvailability({
  policy: getEventSeatPolicy({ eventSeatMode: "SEPARATE", adultSeatCapacity: 3, childSeatCapacity: 5 }),
  capacity: 1, usedAdults: 1, usedChildren: 3,
});
assert.deepEqual(split, { mode: "SEPARATE", capacity: 8, remaining: 4, adultsCapacity: 3, childrenCapacity: 5, adultsRemaining: 2, childrenRemaining: 2 });
assert.equal(getEventSeatError(split, 1, 2, "SEPARATE"), null);
assert.ok(getEventSeatError(split, 1, 3, "SEPARATE")?.includes("детских"));
assert.equal(getEventSeatError(null, 0, 0, "ALL"), "Укажите хотя бы одного участника");
assert.equal(getEventSeatError(null, 1, 0, "CHILDREN"), "Добавьте хотя бы одного ребёнка");
assert.equal(getEventSeatError(null, 0, 1, "ADULTS"), "Добавьте хотя бы одного взрослого");
console.log("eventSeatPolicy: ok");

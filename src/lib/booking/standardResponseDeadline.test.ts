import assert from "node:assert/strict";
import {
  resolveStandardSlotStart,
  standardResponseDeadline,
} from "./standardResponseDeadline";

const created = new Date("2026-11-13T09:00:00.000Z");

// запись за несколько дней → +24ч
assert.equal(
  standardResponseDeadline(created, new Date("2026-11-18T10:00:00.000Z"))?.toISOString(),
  "2026-11-14T09:00:00.000Z",
);
// близко к началу → начало − 2ч
assert.equal(
  standardResponseDeadline(created, new Date("2026-11-13T15:00:00.000Z"))?.toISOString(),
  "2026-11-13T13:00:00.000Z",
);
// граница: ровно 26ч до начала → оба равны
assert.equal(
  standardResponseDeadline(created, new Date("2026-11-14T11:00:00.000Z"))?.toISOString(),
  "2026-11-14T09:00:00.000Z",
);
// без времени начала → null
assert.equal(standardResponseDeadline(created, null), null);
assert.equal(standardResponseDeadline(created, new Date("invalid")), null);

// приоритет источников начала
const a = new Date("2026-12-01T10:00:00.000Z");
const b = new Date("2026-12-02T10:00:00.000Z");
assert.equal(resolveStandardSlotStart({ sessionStartsAt: a, offerSessionStartAt: b }), a);
assert.equal(resolveStandardSlotStart({ offerSessionStartAt: b, startsAt: a }), b);
assert.equal(resolveStandardSlotStart({ startsAt: a }), a);
// дата + время по Минску (+03:00)
assert.equal(
  resolveStandardSlotStart({
    requestedDate: new Date("2026-12-05T00:00:00.000Z"), requestedTime: "14:30",
  })?.toISOString(),
  "2026-12-05T11:30:00.000Z",
);
// только дата или кривое время → null
assert.equal(resolveStandardSlotStart({ requestedDate: new Date("2026-12-05T00:00:00.000Z") }), null);
assert.equal(
  resolveStandardSlotStart({ requestedDate: new Date("2026-12-05T00:00:00.000Z"), requestedTime: "утром" }),
  null,
);
console.log("standardResponseDeadline: ok");

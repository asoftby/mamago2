import assert from "node:assert/strict";
import { subtractCalendarMonths } from "./calendarReminder";

assert.equal(subtractCalendarMonths(new Date("2027-03-31T15:00:00Z"), 1).toISOString(), "2027-02-28T15:00:00.000Z");
assert.equal(subtractCalendarMonths(new Date("2028-03-31T15:00:00Z"), 1).toISOString(), "2028-02-29T15:00:00.000Z");
assert.equal(subtractCalendarMonths(new Date("2027-01-31T15:00:00Z"), 1).toISOString(), "2026-12-31T15:00:00.000Z");
assert.equal(subtractCalendarMonths(new Date("2027-03-30T15:00:00Z"), 2).toISOString(), "2027-01-30T15:00:00.000Z");
assert.throws(() => subtractCalendarMonths(new Date("2027-03-31T15:00:00Z"), 0));

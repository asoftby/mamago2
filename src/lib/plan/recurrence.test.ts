import assert from "node:assert/strict";
import { expandRecurrence } from "./recurrence";

assert.deepEqual(expandRecurrence({frequency:"DAILY", interval:2, startDate:"2026-10-29"}, "2026-10-29","2026-11-03"), ["2026-10-29","2026-10-31","2026-11-02"]);
assert.deepEqual(expandRecurrence({frequency:"WEEKLY", interval:1, startDate:"2026-10-29", weekdays:[1,4]}, "2026-10-29","2026-11-06"), ["2026-10-29","2026-11-02","2026-11-05"]);
assert.deepEqual(expandRecurrence({frequency:"MONTHLY", interval:1, startDate:"2026-01-31"}, "2026-01-01","2026-04-30"), ["2026-01-31","2026-03-31"]);
assert.deepEqual(expandRecurrence({frequency:"DAILY", interval:1, startDate:"2026-10-29", maxOccurrences:3}, "2026-10-31","2026-11-10"), ["2026-10-31"]);
assert.throws(()=>expandRecurrence({frequency:"DAILY", interval:0, startDate:"2026-10-29"}, "2026-10-29","2026-10-30"));
assert.throws(()=>expandRecurrence({frequency:"DAILY", interval:1, startDate:"2026-02-30"}, "2026-02-28","2026-03-01"));

// The optional series cutoff is inclusive, and no cutoff permits subsequent dates.
assert.deepEqual(expandRecurrence({frequency:"DAILY", interval:1, startDate:"2026-10-29", untilDate:"2026-10-31"}, "2026-10-29", "2026-11-03"), ["2026-10-29","2026-10-30","2026-10-31"]);
assert.deepEqual(expandRecurrence({frequency:"DAILY", interval:1, startDate:"2026-10-29"}, "2026-11-01", "2026-11-02"), ["2026-11-01","2026-11-02"]);

import assert from "node:assert/strict";
import { validateRecurrenceInput } from "./recurrenceInput";

const daily = { frequency: "DAILY", interval: 1, startDate: "2026-10-29" };
assert.equal(validateRecurrenceInput(daily).startDate, "2026-10-29");
assert.equal(validateRecurrenceInput({frequency:"WEEKLY", interval:1, startDate:"2026-10-29", weekdays:[4]}).frequency, "WEEKLY");
for (const value of [
  { ...daily, startDate: "2026-02-30" },
  { ...daily, untilDate: "2026-10-28" },
  { ...daily, interval: 0 },
  { ...daily, interval: 1.5 },
  { ...daily, maxOccurrences: 0 },
  { ...daily, weekdays: [1] },
  { frequency: "WEEKLY", interval:1, startDate:"2026-10-29", weekdays:[1] },
  { frequency: "WEEKLY", interval:1, startDate:"2026-10-29", weekdays:[4,4] },
  null
]) assert.throws(() => validateRecurrenceInput(value));

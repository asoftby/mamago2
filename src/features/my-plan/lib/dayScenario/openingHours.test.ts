import assert from "node:assert/strict";
import { resolveDayAvailability, weekdayOf, type PlaceHours } from "./openingHours";

const weekly = (over: Partial<PlaceHours> = {}): PlaceHours => ({
  mode: "WEEKLY",
  timezone: "Europe/Minsk",
  rules: [
    { dayOfWeek: "SAT", isOpen: true, allDay: false, intervals: [{ startTime: "10:00", endTime: "14:00" }, { startTime: "09:00", endTime: "09:30" }] },
    { dayOfWeek: "SUN", isOpen: false, allDay: false, intervals: [] },
    { dayOfWeek: "MON", isOpen: true, allDay: true, intervals: [] },
    { dayOfWeek: "TUE", isOpen: true, allDay: false, intervals: [{ startTime: "18:00", endTime: "02:00" }, { startTime: "bad", endTime: "x" }] },
  ],
  exceptions: [],
  ...over,
});

assert.equal(weekdayOf("2026-11-14"), "SAT");
assert.equal(weekdayOf("2026-11-15"), "SUN");
assert.equal(weekdayOf("2026-11-09"), "MON");

// no hours record: unknown (allowed with a note by the engine)
assert.deepEqual(resolveDayAvailability(null, "2026-11-14"), { kind: "unknown" });

// modes
assert.deepEqual(resolveDayAvailability(weekly({ mode: "ALWAYS_OPEN", rules: [] }), "2026-11-14"), { kind: "always" });
assert.deepEqual(resolveDayAvailability(weekly({ mode: "BY_APPOINTMENT" }), "2026-11-14"), { kind: "closed" });
assert.deepEqual(resolveDayAvailability(weekly({ mode: "TEMPORARILY_CLOSED" }), "2026-11-14"), { kind: "closed" });

// weekly rules: windows sorted, closed day, all-day, missing rule, overnight cut at midnight, bad times skipped
assert.deepEqual(resolveDayAvailability(weekly(), "2026-11-14"), { kind: "windows", windows: [{ startMin: 540, endMin: 570 }, { startMin: 600, endMin: 840 }] });
assert.deepEqual(resolveDayAvailability(weekly(), "2026-11-15"), { kind: "closed" });
assert.deepEqual(resolveDayAvailability(weekly(), "2026-11-09"), { kind: "always" });
assert.deepEqual(resolveDayAvailability(weekly(), "2026-11-11"), { kind: "closed" }, "WEEKLY without a rule for that weekday is closed");
assert.deepEqual(resolveDayAvailability(weekly(), "2026-11-10"), { kind: "windows", windows: [{ startMin: 1080, endMin: 1440 }] });
assert.deepEqual(resolveDayAvailability(weekly({ rules: [] }), "2026-11-14"), { kind: "closed" }, "WEEKLY with no open rules is closed");

// exceptions override the weekly rule for the exact date
const closedHoliday = weekly({ exceptions: [{ date: "2026-11-14", isClosed: true, allDay: false, intervals: [] }] });
assert.deepEqual(resolveDayAvailability(closedHoliday, "2026-11-14"), { kind: "closed" });
const shortDay = weekly({ exceptions: [{ date: "2026-11-14", isClosed: false, allDay: false, intervals: [{ startTime: "12:00", endTime: "13:00" }] }] });
assert.deepEqual(resolveDayAvailability(shortDay, "2026-11-14"), { kind: "windows", windows: [{ startMin: 720, endMin: 780 }] });
const allDayException = weekly({ exceptions: [{ date: "2026-11-15", isClosed: false, allDay: true, intervals: [] }] });
assert.deepEqual(resolveDayAvailability(allDayException, "2026-11-15"), { kind: "always" });
assert.deepEqual(resolveDayAvailability(closedHoliday, "2026-11-21"), { kind: "windows", windows: [{ startMin: 540, endMin: 570 }, { startMin: 600, endMin: 840 }] }, "other dates are unaffected");

console.log("openingHours tests passed");

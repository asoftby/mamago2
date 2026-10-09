import assert from "node:assert/strict";

import {
  addDays,
  addMonths,
  diffDays,
  isDateKey,
  monthMatrix,
  pluralRu,
  relativeLabel,
  startOfWeek,
  todayKey,
  weekDays,
  weekdayShort,
  monthShort,
} from "./dateKey";

// month / year boundaries
assert.equal(addDays("2026-10-31", 1), "2026-11-01");
assert.equal(addDays("2026-12-31", 1), "2027-01-01");
assert.equal(addDays("2027-01-01", -1), "2026-12-31");
assert.equal(addDays("2028-02-28", 1), "2028-02-29");
assert.equal(diffDays("2026-10-08", "2026-10-17"), 9);
assert.equal(diffDays("2026-12-31", "2027-01-01"), 1);
assert.equal(diffDays("2026-10-17", "2026-10-08"), -9);

// Monday is the start of the week
assert.equal(startOfWeek("2026-10-17"), "2026-10-12"); // Saturday
assert.equal(startOfWeek("2026-10-18"), "2026-10-12"); // Sunday
assert.equal(startOfWeek("2026-10-12"), "2026-10-12"); // Monday
assert.deepEqual(weekDays("2026-10-29"), [
  "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29",
  "2026-10-30", "2026-10-31", "2026-11-01",
]);
assert.deepEqual(weekDays("2026-12-31").slice(-1), ["2027-01-03"]);

// ±7 keeps the weekday
assert.equal(weekdayShort(addDays("2026-10-08", 7)), weekdayShort("2026-10-08"));
assert.equal(weekdayShort("2026-10-08"), "ЧТ");
assert.equal(weekdayShort("2026-10-11"), "ВС");

// month matrix: Monday first, 5 or 6 weeks
const oct = monthMatrix("2026-10-15");
assert.equal(oct.length, 5);
assert.equal(oct[0]![0], "2026-09-28");
assert.equal(oct[4]![6], "2026-11-01");
assert.equal(monthMatrix("2027-02-10").length, 5); // Feb 2027 fits 4 rows, padded to 5 for stable height
assert.equal(monthMatrix("2026-08-10").length, 6); // Aug 2026: Sat 1st, 31 days
assert.ok(monthMatrix("2026-08-10").every((w) => w.length === 7));

// month math clamps the day
assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
assert.equal(addMonths("2026-01-15", -1), "2025-12-15");

assert.equal(isDateKey("2026-02-30"), false);
assert.equal(isDateKey("2026-10-17"), true);
assert.equal(isDateKey("2026-1-7"), false);

// relative labels
const today = "2026-10-07";
assert.equal(relativeLabel("2026-10-07", today), "Сегодня");
assert.equal(relativeLabel("2026-10-08", today), "Завтра");
assert.equal(relativeLabel("2026-10-06", today), "Вчера");
assert.equal(relativeLabel("2026-10-15", today), "Четверг, 15 октября");
assert.equal(monthShort("2026-11-01"), "НОЯ");

// plurals
const forms = ["запись", "записи", "записей"] as const;
for (const [n, expected] of [
  [0, "записей"], [1, "запись"], [2, "записи"], [4, "записи"], [5, "записей"],
  [11, "записей"], [12, "записей"], [14, "записей"], [21, "запись"],
  [22, "записи"], [25, "записей"], [101, "запись"], [111, "записей"],
] as const) {
  assert.equal(pluralRu(n, forms), expected, `n=${n}`);
}

// "today" in Europe/Minsk (UTC+3) around midnight
assert.equal(todayKey("Europe/Minsk", new Date("2026-10-07T20:59:00Z")), "2026-10-07"); // 23:59 local
assert.equal(todayKey("Europe/Minsk", new Date("2026-10-07T20:30:00Z")), "2026-10-07"); // 23:30 local
assert.equal(todayKey("Europe/Minsk", new Date("2026-10-07T21:00:00Z")), "2026-10-08"); // 00:00 local
assert.equal(todayKey("Europe/Minsk", new Date("2026-10-07T21:30:00Z")), "2026-10-08"); // 00:30 local

console.log("dateKey.test.ts ok");

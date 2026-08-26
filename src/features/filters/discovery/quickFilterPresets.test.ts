import assert from "node:assert/strict";
import test from "node:test";
import { computePresetRange, matchPreset, todayKeyIn } from "./quickFilterPresets";

// --- todayKeyIn: explicit timezone, not environment-derived ---

test("todayKeyIn uses the explicit timeZone param, not the host clock", () => {
  // 2026-01-01 00:30 UTC — already 2026-01-01 03:30 in Europe/Minsk (UTC+3),
  // but still 2025-12-31 in e.g. America/Los_Angeles. If this read the host
  // TZ instead of the explicit param, this assertion would be flaky by host.
  const instant = new Date("2026-01-01T00:30:00Z");
  assert.equal(todayKeyIn(instant, "Europe/Minsk"), "2026-01-01");
  assert.equal(todayKeyIn(instant, "America/Los_Angeles"), "2025-12-31");
});

// --- TODAY / TOMORROW: trivial but pinned ---

test("TODAY preset is [today, today]", () => {
  assert.deepEqual(computePresetRange("TODAY", "2026-08-24"), {
    from: "2026-08-24",
    to: "2026-08-24",
  });
});

test("TOMORROW preset is [today+1, today+1]", () => {
  assert.deepEqual(computePresetRange("TOMORROW", "2026-08-24"), {
    from: "2026-08-25",
    to: "2026-08-25",
  });
});

// --- WEEKEND: the edge cases the review explicitly asked for ---

test("WEEKEND on a weekday (Mon) resolves to the upcoming Sat-Sun", () => {
  // 2026-08-24 is a Monday.
  assert.deepEqual(computePresetRange("WEEKEND", "2026-08-24"), {
    from: "2026-08-29",
    to: "2026-08-30",
  });
});

test("WEEKEND on Friday resolves to the very next day's weekend", () => {
  // 2026-08-28 is a Friday.
  assert.deepEqual(computePresetRange("WEEKEND", "2026-08-28"), {
    from: "2026-08-29",
    to: "2026-08-30",
  });
});

test("WEEKEND on Saturday is [today, tomorrow] — Sat+Sun, not next weekend", () => {
  // 2026-08-29 is a Saturday.
  assert.deepEqual(computePresetRange("WEEKEND", "2026-08-29"), {
    from: "2026-08-29",
    to: "2026-08-30",
  });
});

test("WEEKEND on Sunday is [today, today] — just the remaining day, not next weekend", () => {
  // 2026-08-30 is a Sunday.
  assert.deepEqual(computePresetRange("WEEKEND", "2026-08-30"), {
    from: "2026-08-30",
    to: "2026-08-30",
  });
});

// --- Month / year boundary crossings ---

test("WEEKEND crosses a month boundary correctly (Fri Jan 30 2026 -> Sat/Sun Jan 31 / Feb 1)", () => {
  // 2026-01-30 is a Friday.
  assert.deepEqual(computePresetRange("WEEKEND", "2026-01-30"), {
    from: "2026-01-31",
    to: "2026-02-01",
  });
});

test("TOMORROW crosses a year boundary (Dec 31 2026 -> Jan 1 2027)", () => {
  assert.deepEqual(computePresetRange("TOMORROW", "2026-12-31"), {
    from: "2027-01-01",
    to: "2027-01-01",
  });
});

test("WEEKEND crosses a year boundary (Wed Dec 30 2026 -> Sat Jan 2 / Sun Jan 3 2027)", () => {
  // 2026-12-30 is a Wednesday.
  assert.deepEqual(computePresetRange("WEEKEND", "2026-12-30"), {
    from: "2027-01-02",
    to: "2027-01-03",
  });
});

test("WEEKEND on New Year's Day itself, when it lands on a Sunday", () => {
  // 2028-01-02 is a Sunday — pick a real Sunday New Year-adjacent date.
  assert.deepEqual(computePresetRange("WEEKEND", "2028-01-02"), {
    from: "2028-01-02",
    to: "2028-01-02",
  });
});

// --- matchPreset: computed chip activity, order-of-click independent ---

test("matchPreset recognizes TODAY from an explicit dateFrom==dateTo pair", () => {
  assert.equal(matchPreset("2026-08-24", "2026-08-24", "2026-08-24"), "TODAY");
});

test("matchPreset treats a missing dateTo as dateFrom (single day)", () => {
  assert.equal(matchPreset("2026-08-24", null, "2026-08-24"), "TODAY");
});

test("matchPreset recognizes a calendar-picked range that happens to equal the weekend preset", () => {
  // Monday 2026-08-24: picking Sat 29 - Sun 30 via the calendar (Фаза 3)
  // must light up the "Выходные" chip even though whenPreset was never set.
  assert.equal(matchPreset("2026-08-29", "2026-08-30", "2026-08-24"), "WEEKEND");
});

test("matchPreset returns null for an arbitrary range matching no preset", () => {
  assert.equal(matchPreset("2026-09-05", "2026-09-07", "2026-08-24"), null);
});

test("matchPreset returns null when nothing is selected", () => {
  assert.equal(matchPreset(null, null, "2026-08-24"), null);
});

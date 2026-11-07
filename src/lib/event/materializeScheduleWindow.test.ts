import assert from "node:assert/strict";
import { extractScheduleOccurrences, type ScheduleOccurrenceWindow } from "./materializeScheduleSessions";

/**
 * Window mode must equal "expand everything, then filter by date" for every shape of schedule,
 * while skipping the periods outside the window.
 */
const key = (o: { date: string; startTime: string; title?: string }) => `${o.date}|${o.startTime}|${o.title ?? ""}`;
const filtered = (json: unknown, w: ScheduleOccurrenceWindow) =>
  extractScheduleOccurrences(json).filter((o) => o.date >= w.from && o.date <= w.to).map(key);

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const bases = ["2026-01-31", "2026-02-28", "2024-02-29", "2026-11-07", "2025-12-31"];
const units = ["day", "week", "month", "year"] as const;
let checked = 0;
for (const base of bases) {
  for (const unit of units) {
    for (const interval of [1, 2, 3]) {
      for (const span of [0, 1, 4]) {
        for (const untilDays of [3, 40, 400, 4000]) {
          const json = {
            scheduleItems: [
              { date: base, dateEnd: span ? addDays(base, span) : undefined, startTime: "11:00", title: "t", recurringEnabled: true, recurrenceInterval: interval, recurrenceUnit: unit, recurrenceUntil: addDays(base, untilDays) },
              { date: "2026-12-05", startTime: "09:30" },
            ],
          };
          for (const offset of [-5, 0, 1, 6, 7, 29, 30, 31, 90, 364, 366, 1000, 3999, 4001]) {
            const from = addDays(base, offset);
            for (const width of [0, 2]) {
              const w = { from, to: addDays(from, width) };
              assert.deepEqual(extractScheduleOccurrences(json, w).map(key), filtered(json, w), `${base} ${unit}x${interval} span ${span} until +${untilDays} window ${w.from}..${w.to}`);
              checked += 1;
            }
          }
        }
      }
    }
  }
}
assert.ok(checked > 10_000, `property sweep ran (${checked} windows)`);

// the legacy `dates` list is a fallback only when items define nothing, regardless of the window
{
  const itemsOutside = { dates: ["2026-11-14"], scheduleItems: [{ date: "2026-12-01", startTime: "10:00" }] };
  assert.deepEqual(extractScheduleOccurrences(itemsOutside, { from: "2026-11-14", to: "2026-11-14" }), [], "items define the schedule: the stray dates entry must not leak into the window");
  const noItems = { dates: ["2026-11-14"], startTime: "12:00", scheduleItems: [{ startTime: "10:00" }] };
  assert.deepEqual(extractScheduleOccurrences(noItems, { from: "2026-11-14", to: "2026-11-14" }).map(key), ["2026-11-14|12:00|"], "items without dates fall back to dates, as in the full expansion");
  assert.deepEqual(extractScheduleOccurrences(noItems, { from: "2026-11-14", to: "2026-11-14" }).map(key), filtered(noItems, { from: "2026-11-14", to: "2026-11-14" }));
}

// cost does not depend on how long a schedule has been running (150 daily schedules, ten years)
{
  const daily = (i: number) => ({ scheduleItems: [{ date: "2026-01-01", startTime: "10:00", recurringEnabled: true, recurrenceInterval: 1, recurrenceUnit: "day", recurrenceUntil: "2036-12-31", title: `e${i}` }] });
  const schedules = Array.from({ length: 150 }, (_, i) => daily(i));
  const t0 = performance.now();
  let found = 0;
  for (const s of schedules) found += extractScheduleOccurrences(s, { from: "2026-11-14", to: "2026-11-14" }).length;
  const ms = performance.now() - t0;
  assert.equal(found, 150, "every daily schedule lands on the day");
  assert.ok(ms < 250, `windowed expansion of 150 ten-year daily schedules took ${Math.round(ms)} ms (the full expansion takes seconds)`);
}

console.log("materializeScheduleWindow tests: OK");

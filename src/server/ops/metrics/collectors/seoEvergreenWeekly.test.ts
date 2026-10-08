/**
 * seoEvergreenWeekly.ts pure-helper tests — no DB or network required.
 * Run: npx tsx src/server/ops/metrics/collectors/seoEvergreenWeekly.test.ts
 */
import assert from "node:assert/strict";

import { completedIsoWeeksSince, weeklyClicksFromPageRows } from "./seoEvergreenWeekly";
import { aggregateRow } from "./googleSearchConsole";

// 2026-09-26 00:00 UTC = 2026-09-25 in Pacific Time; minus the 3-day GSC lag
// the data runs through 2026-09-22, so W38 (Sep 14-20) is the last complete week.
{
  const weeks = completedIsoWeeksSince(new Date("2026-09-26T00:00:00Z"), "2026-W36");
  assert.deepEqual(weeks, [
    { isoWeek: "2026-W36", startDate: "2026-08-31", endDate: "2026-09-06" },
    { isoWeek: "2026-W37", startDate: "2026-09-07", endDate: "2026-09-13" },
    { isoWeek: "2026-W38", startDate: "2026-09-14", endDate: "2026-09-20" },
  ]);
}

// A week becomes complete only once its Sunday is inside the lag window.
{
  const before = completedIsoWeeksSince(new Date("2026-09-29T12:00:00Z"), "2026-W36");
  assert.equal(before.at(-1)?.isoWeek, "2026-W38", "Sep 29 PT - 3 = Sep 26: W39's Sunday not in data yet");
  const after = completedIsoWeeksSince(new Date("2026-09-30T12:00:00Z"), "2026-W36");
  assert.equal(after.at(-1)?.isoWeek, "2026-W39", "Sep 30 PT - 3 = Sep 27: W39 complete");
}

// Cap to the most recent weeks; invalid start week yields nothing.
{
  const weeks = completedIsoWeeksSince(new Date("2027-03-01T12:00:00Z"), "2026-W36", 4);
  assert.equal(weeks.length, 4);
  assert.deepEqual(completedIsoWeeksSince(new Date("2026-09-26T00:00:00Z"), "garbage"), []);
}

// Year boundary: ISO week-year, not calendar year.
{
  const weeks = completedIsoWeeksSince(new Date("2027-01-20T12:00:00Z"), "2026-W52");
  assert.deepEqual(
    weeks.map((w) => w.isoWeek),
    ["2026-W52", "2026-W53", "2027-W01", "2027-W02"],
  );
}

// Evergreen vs total: event and unclear URLs are excluded from the gate metric.
{
  const row = (url: string, clicks: number) => ({ keys: [url], clicks, impressions: clicks * 10, ctr: 0.1, position: 5 });
  const clicks = weeklyClicksFromPageRows("2026-W38", [
    row("https://mamago.by/minsk/places/zoopark", 40),
    row("https://mamago.by/minsk/events/cirk", 30),
    row("https://mamago.by/minsk/blog/novyj-god-2027-afisha", 20),
    row("https://mamago.by/breakingnews/news", 5),
    row("https://mamago.by/", 10),
  ]);
  assert.deepEqual(clicks, { evergreen: 50, total: 105 });
  assert.equal(weeklyClicksFromPageRows("2026-W38", []), null, "no rows = not measured, never 0");
}

// Aggregate query without rows must fail the cycle, not write zeros.
{
  assert.throws(() => aggregateRow([], "current"), /no aggregate row/);
  const row = { clicks: 1, impressions: 2, ctr: 0.5, position: 3 };
  assert.equal(aggregateRow([row], "current"), row);
}

console.log("seoEvergreenWeekly.test.ts: OK");

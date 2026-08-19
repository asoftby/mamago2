import assert from "node:assert/strict";

import {
  addDaysLocal,
  formatLocalPlanDate,
  getLocalDateKey,
  localWallClockToUtc,
} from "./localDateKey";
import { filterUpcomingSessions } from "@/lib/event/filterUpcomingSessions";

{
  const date = new Date("2026-04-23T23:28:00.000Z");
  assert.equal(getLocalDateKey(date), "2026-04-24");
}

{
  assert.equal(addDaysLocal("2026-04-24", 1), "2026-04-25");
  assert.equal(addDaysLocal("2026-04-24", -1), "2026-04-23");
}

{
  assert.equal(formatLocalPlanDate("2026-04-24", "ru-RU"), "24 апреля");
}

// Europe/Minsk midnight window (00:00–03:00): UTC evening still maps to today's local key.
{
  assert.equal(getLocalDateKey(new Date("2026-04-23T21:00:00.000Z")), "2026-04-24");
  assert.equal(getLocalDateKey(new Date("2026-04-23T21:30:00.000Z")), "2026-04-24");
  assert.equal(getLocalDateKey(new Date("2026-04-23T23:00:00.000Z")), "2026-04-24");
  assert.equal(getLocalDateKey(new Date("2026-04-24T00:00:00.000Z")), "2026-04-24");
}

// Fixed `now` in the same window: upcoming session at 01:00 Minsk stays, past one drops.
{
  const now = new Date("2026-04-23T21:15:00.000Z");
  const sessions = [
    { id: "past", startsAt: new Date("2026-04-23T20:00:00.000Z") },
    { id: "upcoming", startsAt: new Date("2026-04-23T22:00:00.000Z") },
  ];
  const filtered = filterUpcomingSessions(sessions, now);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.id, "upcoming");
  assert.equal(getLocalDateKey(filtered[0]!.startsAt), "2026-04-24");
}

// localWallClockToUtc: deterministic regardless of the executing process's
// own OS timezone — a bare `new Date(\`${date}T${time}:00\`)` silently uses
// the *server's* local time, which produced a real several-hour drift on
// the DEV container (runs UTC) versus how times are displayed (browser
// local); confirmed via real-DEV smoke, 2026-08-11.
{
  const utc = localWallClockToUtc("2026-09-19", "12:30");
  assert.equal(utc.toISOString(), "2026-09-19T09:30:00.000Z", "Europe/Minsk is UTC+3, no DST");
}
{
  // Midnight-crossing: 01:00 Minsk-local on the 19th is still the 18th in UTC.
  const utc = localWallClockToUtc("2026-09-19", "01:00");
  assert.equal(utc.toISOString(), "2026-09-18T22:00:00.000Z");
}
{
  // Round-trips through getLocalDateKey back to the same local date.
  const utc = localWallClockToUtc("2026-09-19", "23:45");
  assert.equal(getLocalDateKey(utc), "2026-09-19");
}

console.log("localDateKey tests: OK");

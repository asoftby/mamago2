import assert from "node:assert/strict";

import {
  addDaysLocal,
  formatLocalPlanDate,
  getLocalDateKey,
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

console.log("localDateKey tests: OK");

import assert from "node:assert/strict";
import { buildEventCalendarSummary } from "./eventCalendarSummary";

const session = new Map([["s1", { startsAt: new Date("2026-11-28T09:00:00Z") }]]);
const titles = new Map([["e1", "Мастер-класс"]]);
const base = { activityId: "e1", requestedDate: null, requestedTime: null };
const summary = buildEventCalendarSummary([
  { ...base, selectedSessionId: "s1", status: "NEW", _count: { _all: 2 }, _sum: { adultsCount: 2, childrenCount: 3 } },
  { ...base, selectedSessionId: "s1", status: "CONFIRMED", _count: { _all: 1 }, _sum: { adultsCount: 1, childrenCount: 2 } },
  { ...base, selectedSessionId: null, requestedDate: new Date("2026-11-28"), requestedTime: "12:00", status: "CONFIRMED", _count: { _all: 1 }, _sum: { adultsCount: 0, childrenCount: 1 } },
], session, titles);
assert.equal(summary.length, 1, "session-linked and legacy date/time records combine");
assert.deepEqual(summary[0], {
  activityId: "e1", date: "2026-11-28", time: "12:00", sessionId: "s1",
  title: "Мастер-класс", bookings: 4, adults: 3, children: 6, newCount: 2, confirmedCount: 2,
});
assert.deepEqual(buildEventCalendarSummary([], session, titles), []);
console.log("eventCalendarSummary: ok");

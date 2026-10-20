import assert from "node:assert/strict";
import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import {
  formatActivitySearchDates,
  formatSearchDateRange,
  formatSearchOpeningHours,
  formatSearchPublicationPrice,
} from "./resultCardMeta";

assert.equal(formatSearchDateRange("2026-09-04"), "4 сен");
assert.equal(formatSearchDateRange("2026-09-04", "2026-09-12"), "4–12 сен");
assert.equal(formatSearchDateRange("2026-09-04", "2026-10-12"), "4 сен – 12 окт");
assert.equal(formatSearchDateRange("invalid"), null);
assert.equal(formatActivitySearchDates({
  scheduleJson: { dateFrom: "2026-09-04", dateTo: "2026-09-12" },
}), "4–12 сен");
assert.equal(formatActivitySearchDates({
  sessions: [{ startsAt: new Date("2026-09-04T10:00:00+03:00") }, { startsAt: new Date("2026-09-12T10:00:00+03:00") }],
}), "4–12 сен");
assert.equal(formatActivitySearchDates({
  sessions: [{ startsAt: new Date("2026-09-04T10:00:00+03:00") }, { startsAt: new Date("2026-12-12T10:00:00+03:00") }],
}), "4 сен");

assert.equal(formatSearchPublicationPrice({ priceMode: "FROM", priceFrom: 15 }), `от 15 ${BYN_SYMBOL}`);
assert.equal(formatSearchPublicationPrice({ priceMode: "EXACT", priceFrom: 15 }), `15 ${BYN_SYMBOL}`);
assert.equal(formatSearchPublicationPrice({ priceMode: "RANGE", priceFrom: 15, priceTo: 300 }), `15–300 ${BYN_SYMBOL}`);
assert.equal(formatSearchPublicationPrice({ priceMode: "FREE" }), "Бесплатно");
assert.equal(formatSearchPublicationPrice({ priceMode: "NONE", priceFrom: 150 }), null);
assert.equal(formatSearchPublicationPrice({ priceMode: "FROM", priceFrom: null }), null);

const daily = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((dayOfWeek) => ({
  dayOfWeek, isOpen: true, allDay: false, intervals: [{ startTime: "10:00", endTime: "20:00" }],
}));
assert.equal(formatSearchOpeningHours(daily), "Ежедневно 10:00–20:00");
assert.equal(formatSearchOpeningHours(daily.slice(0, 5)), "Пн–Пт 10:00–20:00");
assert.equal(formatSearchOpeningHours([]), null);
assert.equal(formatSearchOpeningHours(daily.map((r) => ({ ...r, allDay: true }))), "Круглосуточно");

// A capped preview cannot be used to claim a shortened event end date.
const manySessions = Array.from({ length: 41 }, (_, i) => ({
  startsAt: new Date(Date.UTC(2026, 8, 4 + Math.floor(i / 4), 7)),
}));
assert.equal(formatActivitySearchDates({ sessions: manySessions, sessionsTruncated: true }), "4 сен");
assert.equal(formatActivitySearchDates({ sessions: manySessions.slice(0, 40), sessionsTruncated: false }), "4–13 сен");

// Interval order must be stable even if database relation order differs.
const splitDay = [{
  dayOfWeek: "MON",
  isOpen: true,
  allDay: false,
  intervals: [
    { startTime: "18:00", endTime: "22:00", sortOrder: 1 },
    { startTime: "09:00", endTime: "12:00", sortOrder: 0 },
  ],
}];
assert.equal(formatSearchOpeningHours(splitDay), "Пн 09:00–12:00, 18:00–22:00");

console.log("Search result card date, price and opening-hours contracts: OK");

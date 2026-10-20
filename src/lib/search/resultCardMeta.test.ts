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

console.log("Search result card date, price and opening-hours contracts: OK");

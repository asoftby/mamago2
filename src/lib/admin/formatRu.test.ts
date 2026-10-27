import assert from "node:assert/strict";
import {
  formatAdminDate,
  formatAdminDateRange,
  formatAdminDateTime,
  formatAdminNumber,
  formatAdminPercent,
  formatAdminTime,
} from "./formatRu";

// 27 Oct 2026 05:46 UTC = 08:46 Minsk (UTC+3, no DST).
const d = new Date("2026-10-27T05:46:00.000Z");
assert.equal(formatAdminDate(d), "27 окт. 2026");
assert.equal(formatAdminDateTime(d), "27.10.2026, 08:46");
assert.equal(formatAdminTime(d), "08:46");
assert.equal(formatAdminDateTime("2026-10-27T05:46:00.000Z"), "27.10.2026, 08:46", "ISO strings (API payloads)");

// Minsk midnight: 21:30Z on the 26th is already the 27th in Minsk.
assert.equal(formatAdminDate(new Date("2026-10-26T21:30:00.000Z")), "27 окт. 2026");
assert.equal(formatAdminDateTime(new Date("2026-10-26T20:59:00.000Z")), "26.10.2026, 23:59");

assert.equal(formatAdminDateRange("2026-10-01T00:00:00Z", d), "1 окт. 2026 — 27 окт. 2026");
assert.equal(formatAdminDate(null), "—");
assert.equal(formatAdminDate("not a date"), "—");
assert.equal(formatAdminDateTime(undefined), "—");

assert.equal(formatAdminNumber(12345).replace(/\s/g, " "), "12 345");
assert.equal(formatAdminNumber(null), "—");
assert.equal(formatAdminNumber(Number.NaN), "—");
assert.equal(formatAdminPercent(0.1234), "12,3%");
assert.equal(formatAdminPercent(null), "—");

console.log("formatRu.test.ts: OK");

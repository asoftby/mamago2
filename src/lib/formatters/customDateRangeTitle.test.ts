import assert from "node:assert/strict";
import { formatRuCustomDateRangeTitle } from "./date";

assert.equal(formatRuCustomDateRangeTitle("2026-10-21", "2026-10-25"), "с 21 по 25 окт.");
assert.equal(formatRuCustomDateRangeTitle("2026-10-21", "2026-11-25"), "с 21 окт. по 25 ноя.");
assert.equal(formatRuCustomDateRangeTitle("2026-12-31", "2027-01-02"), "с 31 дек. 2026 по 2 янв. 2027");
assert.equal(formatRuCustomDateRangeTitle("2026-10-21", "2026-10-21"), "21 окт.");
assert.equal(formatRuCustomDateRangeTitle("2026-10-21", null), "21 окт.");
assert.equal(formatRuCustomDateRangeTitle("invalid", "2026-10-25"), "");
assert.equal(formatRuCustomDateRangeTitle("2026-02-30", "2026-03-02"), "");
assert.equal(formatRuCustomDateRangeTitle(null, null), "");

console.log("Custom discovery date headings: OK");

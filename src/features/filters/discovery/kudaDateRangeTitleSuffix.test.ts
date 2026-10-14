import assert from "node:assert/strict";
import { kudaDateRangeTitleSuffix } from "./whenLabel";
const format = (from: string | null, to: string | null, whenPreset: "TODAY" | "TOMORROW" | "WEEKEND" | null = null) =>
  kudaDateRangeTitleSuffix({ whenPreset, dateFrom: from, dateTo: to });
assert.equal(format("2026-10-21", "2026-10-25"), " с 21 по 25 окт.");
assert.equal(format("2026-10-21", "2026-11-25"), " с 21 окт. по 25 ноя.");
assert.equal(format("2026-12-30", "2027-01-02"), " с 30 дек. 2026 по 2 янв. 2027");
assert.equal(format("2026-10-21", "2026-10-21"), " 21 окт.");
assert.equal(format("2026-10-21", null), " 21 окт.");
assert.equal(format(null, null), "");
assert.equal(format("2026-02-31", "2026-03-02"), "");
assert.equal(format("2026-10-25", "2026-10-21"), " 25 окт.");
assert.equal(format("2026-10-21", "2026-10-25", "TODAY"), " сегодня");
console.log("kudaDateRangeTitleSuffix.test: OK");

import assert from "node:assert/strict";
import { weekDays } from "@/lib/date/dateKey";
import { dayAriaLabel, recordsCountLabel, weekHeaderLabel } from "./labels";

assert.equal(weekHeaderLabel(weekDays("2026-10-14")), "ОКТЯБРЬ 2026");
assert.equal(weekHeaderLabel(weekDays("2026-10-29")), "ОКТ — НОЯ 2026");
assert.equal(weekHeaderLabel(weekDays("2026-12-31")), "ДЕК 2026 — ЯНВ 2027");
assert.equal(dayAriaLabel("2026-10-08", { today: true, count: 2 }), "Четверг, 8 октября, сегодня, записей: 2");
assert.equal(dayAriaLabel("2026-10-09", { today: false, count: 0 }), "Пятница, 9 октября, записей: 0");
assert.equal(recordsCountLabel(1), "1 запись");
assert.equal(recordsCountLabel(3), "3 записи");
console.log("plan-calendar labels.test.ts ok");

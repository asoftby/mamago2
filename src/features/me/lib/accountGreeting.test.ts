import assert from "node:assert/strict";
import { getGreetingForHour, getHourInTimeZone } from "./accountGreeting";

assert.equal(getGreetingForHour(2), "Доброй ночи");
assert.equal(getGreetingForHour(8), "Доброе утро");
assert.equal(getGreetingForHour(14), "Добрый день");
assert.equal(getGreetingForHour(20), "Добрый вечер");

// 2026-10-05 11:04 UTC = 14:04 in Minsk. The server runs in UTC,
// so the account greeting must use the product timezone rather than server local time.
const instant = new Date("2026-10-05T11:04:00.000Z");
assert.equal(getHourInTimeZone(instant, "Europe/Minsk"), 14);
assert.equal(
  getGreetingForHour(getHourInTimeZone(instant, "Europe/Minsk")),
  "Добрый день",
);

console.log("account greeting timezone regressions: OK");

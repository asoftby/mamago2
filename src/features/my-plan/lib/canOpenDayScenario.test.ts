import assert from "node:assert/strict";
import { canOpenDayScenario } from "./canOpenDayScenario";

assert.equal(canOpenDayScenario(0), false, "0 items — no CTA");
assert.equal(canOpenDayScenario(1), false, "1 item — no CTA");
assert.equal(canOpenDayScenario(2), false, "2 items — no CTA");
assert.equal(canOpenDayScenario(3), true, "3 items — CTA available");
assert.equal(canOpenDayScenario(4), true, "4+ items — CTA available");

console.log("canOpenDayScenario tests: OK");

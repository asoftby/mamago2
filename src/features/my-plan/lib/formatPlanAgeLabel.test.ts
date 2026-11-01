import assert from "node:assert/strict";
import { formatPlanAgeLabel } from "./formatPlanAgeLabel";

assert.equal(formatPlanAgeLabel("9–12 лет, 12–14 лет, 14–16 лет, 16–18 лет"), "9–18 лет");
assert.equal(formatPlanAgeLabel("3–5 лет, 5–7 лет, 18+"), "3+");
assert.equal(formatPlanAgeLabel("18+"), "18+");
assert.equal(formatPlanAgeLabel("0–1 год, 1–3 года"), "0–3 года");
assert.equal(formatPlanAgeLabel("3–5 лет"), "3–5 лет");
assert.equal(formatPlanAgeLabel("3-5 лет; 7-9 лет"), "3–9 лет");
assert.equal(formatPlanAgeLabel("С любого возраста"), "С любого возраста");
assert.equal(formatPlanAgeLabel(null), null);

console.log("formatPlanAgeLabel.test.ts: OK");

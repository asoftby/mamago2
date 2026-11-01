import assert from "node:assert/strict";
import { planAudienceLabel } from "./planAudienceLabel";

assert.equal(planAudienceLabel([], false), "Для всех");
assert.equal(planAudienceLabel(["Я"], false), "Для меня");
assert.equal(planAudienceLabel(["Степан"], false), "Для Степана");
assert.equal(planAudienceLabel(["Таисия"], false), "Для Таисии");
assert.equal(planAudienceLabel(["Я", "Степан"], false), "Для выбранных");
assert.equal(planAudienceLabel([], true), "Для выбранных");
console.log("planAudienceLabel: ok");

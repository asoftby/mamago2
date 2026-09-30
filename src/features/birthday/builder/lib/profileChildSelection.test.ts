import assert from "node:assert/strict";
import { exactProfileChildToParty, profileChildAgeYears, profileChildCanApplyDirectly } from "./profileChildSelection";

const now = new Date("2026-05-10T00:00:00Z");
const day = { id: "d", name: null, birthDate: "2020-05-10T00:00:00Z", birthPrecision: "DAY" as const };
const month = { id: "m", name: "M", birthDate: "2020-05-15T00:00:00Z", birthPrecision: "MONTH" as const };
const legacy = { id: "l", name: "L", birthDate: "2020-05-27T00:00:00Z", birthPrecision: null };

assert.equal(profileChildCanApplyDirectly(day), true);
assert.equal(exactProfileChildToParty(day, now).profileChildId, "d");
assert.equal(exactProfileChildToParty(day, now).name, "Ребёнок");
assert.equal(profileChildCanApplyDirectly(month), false);
assert.equal(profileChildCanApplyDirectly(legacy), false);
assert.throws(() => exactProfileChildToParty(month, now), /полная дата/);
assert.throws(() => exactProfileChildToParty(legacy, now), /полная дата/);
assert.equal(profileChildAgeYears(month, new Date("2026-05-01T00:00:00Z")), 6);
assert.equal(profileChildAgeYears(legacy, new Date("2026-05-01T00:00:00Z")), 6);
const refinedMonth = { ...month, birthDate: "2020-05-17T00:00:00Z", birthPrecision: "DAY" as const };
assert.equal(exactProfileChildToParty(refinedMonth, now).profileChildId, "m");
assert.equal(exactProfileChildToParty(refinedMonth, now).birthDateIso, "2020-05-17");

console.log("profileChildSelection.test.ts: OK");

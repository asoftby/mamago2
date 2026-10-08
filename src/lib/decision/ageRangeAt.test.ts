import assert from "node:assert/strict";
import { ageRangeAt } from "./ageRangeAt";

// 2 years old exactly on the target date -> "1-3"
assert.equal(ageRangeAt(new Date("2024-01-15"), new Date("2026-01-15")), "1-3");

// One day before the 2nd birthday -> still "1-3" (23 months)
assert.equal(ageRangeAt(new Date("2024-01-15"), new Date("2026-01-14")), "1-3");

// Newborn on the target date -> "0-1"
assert.equal(ageRangeAt(new Date("2026-01-01"), new Date("2026-01-01")), "0-1");

// Exactly 18 years -> open-ended "18+" bucket
assert.equal(ageRangeAt(new Date("2008-01-15"), new Date("2026-01-15")), "18+");

// Target date before birth -> no valid range
assert.equal(ageRangeAt(new Date("2026-06-01"), new Date("2026-01-01")), null);

// Invalid dates -> null, never throws
assert.equal(ageRangeAt(new Date("not-a-date"), new Date("2026-01-01")), null);

console.log("ageRangeAt.test.ts OK");

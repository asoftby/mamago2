/**
 * Run: npx tsx src/lib/system/runtimeStart.test.ts
 */
import assert from "node:assert/strict";

import { getProcessStartedAt } from "./runtimeStart";

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const first = getProcessStartedAt();
assert.match(first, ISO_8601, "processStartedAt must be a valid ISO-8601 timestamp");
assert.ok(!Number.isNaN(Date.parse(first)), "processStartedAt must be parseable as a date");

const second = getProcessStartedAt();
assert.equal(first, second, "repeated calls within the same process must return the same value");

console.log("runtimeStart.test.ts: OK");

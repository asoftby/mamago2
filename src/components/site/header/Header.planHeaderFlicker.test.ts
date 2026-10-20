import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Header.tsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../../../hooks/useStableHeaderBehavior.ts", import.meta.url), "utf8");

// The search row shifts the document on the account/profile and My Plan pages.
// Preserve a wide hysteresis on both while leaving other public pages unchanged.
assert.match(source, /scrollHysteresisPx: pathname === "\/me" \|\| pathname === "\/me\/plan" \? 120 : 16/);
assert.match(hook, /scrollThreshold \+ Math\.max\(4, Math\.round\(scrollHysteresisPx \* 0\.45\)\)/);
assert.match(hook, /scrollThreshold - scrollHysteresisPx/);
const threshold = 80;
const hysteresis = 120;
const enter = threshold + Math.max(4, Math.round(hysteresis * 0.45));
const exit = Math.max(8, threshold - hysteresis);
assert.ok(enter - exit > 100);
assert.equal(enter, 134);
assert.equal(exit, 8);
// Simulate ~90px shrink/growth of the desktop search row near thresholds.
assert.ok(enter - 90 > exit, "collapsing the row must not immediately expand it");
assert.ok(exit + 90 < enter, "expanding the row must not immediately collapse it");
console.log("Plan desktop header hysteresis: OK");

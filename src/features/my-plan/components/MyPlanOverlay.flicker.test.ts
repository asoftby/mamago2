import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const overlay = readFileSync(new URL("./MyPlanOverlay.tsx", import.meta.url), "utf8");
const content = readFileSync(new URL("./PlanMainContent.tsx", import.meta.url), "utf8");

// The sheet already slides in; do not fade the whole content a second time.
assert.match(overlay, /<ResponsiveOverlay/);
assert.doesNotMatch(overlay, /animate-in fade-in-0 duration-150/);

// Keep the two nested screens within the sheet while sliding in Safari.
assert.doesNotMatch(content, /w-\[200%\] transform-gpu/);
assert.match(content, /min-w-0 flex-1 w-\[200%\] transition-transform/);
assert.equal((content.match(/h-full min-h-0 min-w-0 w-1\/2 shrink-0/g) ?? []).length, 2);
console.log("MyPlanOverlay.flicker.test.ts: OK");

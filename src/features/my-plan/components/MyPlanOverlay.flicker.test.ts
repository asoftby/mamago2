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
// The close icon stays in the header for swipe/scroll behavior, but aligns with
// the main week heading on the tight authenticated overlay (not the kicker).
const planHeader = readFileSync(new URL("./MyPlanHeader.tsx", import.meta.url), "utf8");
assert.match(planHeader, /tight \? "translate-y-7" : ""/);

// The desktop header active-filters dot is 5px (half its former 10px size)
// and uses the same red-500 token as the notification-bell count badge.
const filtersButton = readFileSync(new URL("../../../components/discovery/RefinementFiltersButtonCompact.tsx", import.meta.url), "utf8");
const notifications = readFileSync(new URL("../../../components/site/header/NotificationsDropdown.tsx", import.meta.url), "utf8");
assert.match(filtersButton, /h-\\[5px\\] w-\\[5px\\] rounded-full bg-red-500/);
assert.match(notifications, /rounded-full bg-red-500/);

console.log("MyPlanOverlay.flicker.test.ts: OK");

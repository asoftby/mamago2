import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanItemRow, decideRowClickCapture, getConcealedDeleteA11yProps } from "./PlanItemRow";
import type { PlanItemWithActivity } from "../types/event";

function item(id: string, title = `Item ${id}`): PlanItemWithActivity {
  return {
    id,
    userId: "user",
    activityId: null,
    date: "2026-09-01",
    startsAt: null,
    title,
    coverImageUrl: null,
    createdAt: new Date("2026-08-01"),
    activity: null,
  };
}

// --- B. Concealed delete action must not be keyboard-reachable or exposed
// to assistive tech while the swipe panel is closed, and must be normal and
// reachable once revealed. ---
assert.deepEqual(getConcealedDeleteA11yProps(false), { tabIndex: -1, "aria-hidden": true });
assert.deepEqual(getConcealedDeleteA11yProps(true), { tabIndex: 0, "aria-hidden": false });

// Wiring check: the actual rendered button (initial, unrevealed state)
// carries these exact attributes — not just the pure function in isolation.
const restingHtml = renderToStaticMarkup(<PlanItemRow item={item("one")} onRemove={() => undefined} />);
assert.match(restingHtml, /Убрать[\s\S]*?<\/button>/); // sanity: the concealed button renders at all
const concealedButtonMatch = restingHtml.match(/<button[^>]*>[\s\S]*?Убрать[\s\S]*?<\/button>/);
assert.ok(concealedButtonMatch, "concealed delete button must be present in resting markup");
assert.match(concealedButtonMatch![0], /tabindex="-1"/);
assert.match(concealedButtonMatch![0], /aria-hidden="true"/);

// The separate hover/focus X button (the documented accessible alternative)
// must remain a normal, always-focusable control — this fix must not touch it.
const xButtonMatch = restingHtml.match(/<button[^>]*aria-label="Убрать[^"]*из плана"[^>]*>/);
assert.ok(xButtonMatch, "the hover/focus X button must still be present");
assert.doesNotMatch(xButtonMatch![0], /tabindex="-1"/);
assert.doesNotMatch(xButtonMatch![0], /aria-hidden/);

// --- C. A long-press-opened reveal must survive the synthetic click that
// follows touchend; a genuine follow-up tap (or a click while a
// swipe-opened panel is showing) must still close it. ---

// The synthetic click immediately after a long-press opened the panel:
// consume it silently, do not close.
assert.deepEqual(decideRowClickCapture(true, true), { consumeSuppress: true, shouldClose: false });

// A deliberate click while revealed (swipe-opened, or any click after the
// suppress flag has already been consumed) still closes the panel — this
// is the pre-existing, unchanged behavior for a real follow-up tap.
assert.deepEqual(decideRowClickCapture(true, false), { consumeSuppress: false, shouldClose: true });

// Not revealed, no suppression pending: an ordinary click (e.g. the title
// link) must pass through untouched.
assert.deepEqual(decideRowClickCapture(false, false), { consumeSuppress: false, shouldClose: false });

// Defensive: a stale suppress flag with nothing revealed is still consumed
// rather than leaking into unrelated close logic.
assert.deepEqual(decideRowClickCapture(false, true), { consumeSuppress: true, shouldClose: false });

// --- Wiring: the suppress flag is armed only where the long-press timer
// actually opens the reveal, reset at the start of every new touch, and
// consumed (not left dangling) in the click-capture handler. Interaction
// mounting isn't available in this harness (no jsdom/RTL), so this is a
// static-source contract over the actual touch handlers. ---
const rowSource = readFileSync(new URL("./PlanItemRow.tsx", import.meta.url), "utf8");

assert.match(
  rowSource,
  /longPressTimerRef\.current = window\.setTimeout\(\(\) => \{\s*setDragX\(-REVEAL_WIDTH\);\s*setRevealed\(true\);\s*suppressNextClickRef\.current = true;\s*\}, LONG_PRESS_MS\);/,
  "long-press timer must arm the suppress flag exactly when it opens the reveal",
);
assert.match(
  rowSource,
  /suppressNextClickRef\.current = false;\s*clearLongPress\(\);\s*longPressTimerRef\.current = window\.setTimeout/,
  "every new touch start must reset any stale suppress flag before arming a new long-press timer",
);
assert.match(
  rowSource,
  /const decision = decideRowClickCapture\(revealed, suppressNextClickRef\.current\);/,
  "click capture must route through the pure decision function",
);

// --- Swipe-drag behavior (untouched by this fix) must remain intact. ---
assert.match(rowSource, /const SWIPE_OPEN_THRESHOLD = REVEAL_WIDTH \/ 2;/);
assert.match(rowSource, /if \(dragX <= -SWIPE_OPEN_THRESHOLD\) \{\s*setDragX\(-REVEAL_WIDTH\);\s*setRevealed\(true\);/);
assert.match(rowSource, /if \(dx <= 0\) setDragX\(Math\.max\(dx, -REVEAL_WIDTH\)\);/);

console.log("PlanItemRow accessibility + long-press regression tests: OK");

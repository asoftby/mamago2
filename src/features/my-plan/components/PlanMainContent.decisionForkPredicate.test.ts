import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Regression coverage for a P2 review finding on PR #163: the compact/mobile
// rendering branch used the stale `suggestionsGeneration === 0` check for the
// "Реши за меня / Сама решу" decision-fork CTA while the desktop branch
// already used `showDecisionFork` (empty day AND suggestions not yet
// requested). That let the CTA reappear on mobile over an already-filled
// day. This file has no jsdom/RTL harness to mount PlanMainContent (it needs
// many providers/hooks), so this is a static-source contract: both rendering
// branches must gate the decision fork on the exact same predicate.
const source = readFileSync(new URL("./PlanMainContent.tsx", import.meta.url), "utf8");

// A. Desktop branch: empty day (no dayPartSections) + suggestions not yet
// requested => decision fork shows. Filled day or suggestions already
// requested => it doesn't. This branch already used the right predicate.
assert.match(
  source,
  /awaitingAgeAnswer \? \(\s*<PlanNeedsAgeQuestion onConfirm={handleAgeAnswerConfirm} onCancel={handleAgeAnswerCancel} \/>\s*\) : showDecisionFork \? \(/,
  "desktop rendering branch must gate the decision fork on showDecisionFork",
);

// A. Compact/mobile branch: must use the identical predicate, not a
// duplicated or divergent condition.
assert.match(
  source,
  /awaitingAgeAnswer \? \(\s*<PlanNeedsAgeQuestion onConfirm={handleAgeAnswerConfirm} onCancel={handleAgeAnswerCancel} compact \/>\s*\) : showDecisionFork \? \(/,
  "compact rendering branch must gate the decision fork on showDecisionFork, matching desktop",
);

// The old buggy predicate must be gone from the rendering ternary entirely
// (suggestionsGeneration === 0 is still legitimately used elsewhere in the
// file for unrelated batch-count checks, so this targets only the ternary
// form that gated the decision fork).
assert.doesNotMatch(
  source,
  /\) : suggestionsGeneration === 0 \? \(/,
  "the stale suggestionsGeneration === 0 decision-fork condition must not remain",
);

// showDecisionFork itself is unchanged: empty day AND suggestions not
// requested. Both rendering branches now read it, plus its own definition.
assert.match(
  source,
  /const showDecisionFork = dayPartSections\.length === 0 && !hasRequestedSuggestions;/,
);
assert.equal((source.match(/showDecisionFork/g) ?? []).length, 3, "definition + both rendering branches");

console.log("PlanMainContent decision-fork predicate contract: OK");

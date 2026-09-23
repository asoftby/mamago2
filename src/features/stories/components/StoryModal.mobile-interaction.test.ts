import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./StoryModal.tsx", import.meta.url), "utf8");

assert.doesNotMatch(
  source,
  /swipe down.*close|dy\s*>\s*72|onTouchStart=\{handleTouchStart\}|onTouchEnd=\{handleTouchEnd\}/i,
  "StoryModal must not close from a vertical mobile swipe/scroll",
);

assert.match(
  source,
  /if \(e\.target === backdropRef\.current\) onClose\(\)/,
  "Explicit backdrop close must remain available",
);

assert.match(
  source,
  /<ModalCloseButton[\s\S]*onClick=\{onClose\}/,
  "Explicit close button must remain available",
);

console.log("StoryModal mobile interaction contract tests: OK");

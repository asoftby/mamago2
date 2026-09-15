import assert from "node:assert/strict";
import { isJournalPath } from "@/lib/intent";

import {
  DISCOVERY_INTENT_CONFIG,
  DISCOVERY_INTENT_ITEMS,
  PRIMARY_NAVIGATION_ITEMS,
} from "./discoveryIntentConfig";

// Инвариант: раздел не может одновременно быть кликабельным в primary
// navigation и помечен как «Скоро».
for (const item of DISCOVERY_INTENT_ITEMS) {
  assert.ok(
    !(item.comingSoon && item.navigationEnabled),
    `${item.id}: comingSoon: true requires navigationEnabled: false`,
  );
}

assert.deepEqual(
  PRIMARY_NAVIGATION_ITEMS.map((item) => item.label),
  ["Куда пойти", "Журнал", "Занятия", "Праздник", "Маршруты"],
);
const journal = PRIMARY_NAVIGATION_ITEMS.find((item) => item.id === "journal");
assert.ok(journal);
assert.equal(journal.href("minsk"), "/minsk/blog");
assert.equal(journal.navigationEnabled, true);
assert.equal(journal.comingSoon, false);
assert.equal(isJournalPath("/minsk/blog"), true);
assert.equal(isJournalPath("/minsk/blog/how-to-play"), true);
assert.equal(isJournalPath("/minsk/events"), false);

// Текущий релиз: «Куда пойти» и «Журнал» кликабельны в primary navigation.
assert.equal(DISCOVERY_INTENT_CONFIG.kuda.navigationEnabled, true);
assert.equal(DISCOVERY_INTENT_CONFIG.kuda.comingSoon, false);

for (const id of ["classes", "birthday", "routes"] as const) {
  assert.equal(DISCOVERY_INTENT_CONFIG[id].navigationEnabled, false, `${id}.navigationEnabled`);
  assert.equal(DISCOVERY_INTENT_CONFIG[id].comingSoon, true, `${id}.comingSoon`);
}

console.log("discoveryIntentConfig.test.ts: OK");

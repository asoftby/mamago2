import assert from "node:assert/strict";

import { DISCOVERY_INTENT_CONFIG, DISCOVERY_INTENT_ITEMS } from "./discoveryIntentConfig";

// Инвариант: раздел не может одновременно быть кликабельным в primary
// navigation и помечен как «Скоро».
for (const item of DISCOVERY_INTENT_ITEMS) {
  assert.ok(
    !(item.comingSoon && item.navigationEnabled),
    `${item.id}: comingSoon: true requires navigationEnabled: false`,
  );
}

// Текущий релиз: только «Куда пойти» кликабелен в primary navigation.
assert.equal(DISCOVERY_INTENT_CONFIG.kuda.navigationEnabled, true);
assert.equal(DISCOVERY_INTENT_CONFIG.kuda.comingSoon, false);

for (const id of ["classes", "birthday", "routes"] as const) {
  assert.equal(DISCOVERY_INTENT_CONFIG[id].navigationEnabled, false, `${id}.navigationEnabled`);
  assert.equal(DISCOVERY_INTENT_CONFIG[id].comingSoon, true, `${id}.comingSoon`);
}

console.log("discoveryIntentConfig.test.ts: OK");

import assert from "node:assert/strict";
import {
  isBusinessFeatureEnabled,
  mergeBusinessFeatures,
  parseBusinessFeatures,
  parseBusinessFeaturesPatch,
} from "./businessFeatures";

// Отсутствующие и невалидные значения = выключено
assert.deepEqual(parseBusinessFeatures(undefined), { leadForm: false, selections: false });
assert.deepEqual(parseBusinessFeatures("x"), { leadForm: false, selections: false });
assert.deepEqual(parseBusinessFeatures([true]), { leadForm: false, selections: false });
assert.deepEqual(parseBusinessFeatures({ newOfferWizard: "true", leadForm: 1, selections: true }), {
  leadForm: false,
  selections: true,
});
// Неизвестные ключи отбрасываются при чтении
assert.deepEqual(Object.keys(parseBusinessFeatures({ other: true })).sort(), ["leadForm", "selections"]);

assert.equal(isBusinessFeatureEnabled({ features: { leadForm: true } }, "leadForm"), true);
assert.equal(isBusinessFeatureEnabled({ features: {} }, "leadForm"), false);
assert.equal(isBusinessFeatureEnabled(null, "leadForm"), false);

// merge сохраняет остальные и неизвестные ключи
assert.deepEqual(mergeBusinessFeatures({ leadForm: true, future: 1, newOfferWizard: false }, { selections: true }), {
  leadForm: true,
  future: 1,
  newOfferWizard: false,
  selections: true,
});
assert.deepEqual(mergeBusinessFeatures(null, { selections: false }), { selections: false });

// patch: только известные ключи с boolean
assert.deepEqual(parseBusinessFeaturesPatch({ leadForm: true }), { leadForm: true });
assert.equal(parseBusinessFeaturesPatch({}), null);
assert.equal(parseBusinessFeaturesPatch({ leadForm: "yes" }), null);
assert.equal(parseBusinessFeaturesPatch({ unknown: true }), null);
assert.equal(parseBusinessFeaturesPatch({ newOfferWizard: true }), null, "Retired toggle cannot re-enable V1");
assert.deepEqual(parseBusinessFeatures({ newOfferWizard: false, leadForm: true }), { leadForm: true, selections: false });
assert.equal(parseBusinessFeaturesPatch(null), null);

console.log("businessFeatures.test.ts: ok");

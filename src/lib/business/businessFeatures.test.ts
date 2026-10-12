import assert from "node:assert/strict";
import {
  isBusinessFeatureEnabled,
  mergeBusinessFeatures,
  parseBusinessFeatures,
  parseBusinessFeaturesPatch,
} from "./businessFeatures";

// Отсутствующие и невалидные значения = выключено
assert.deepEqual(parseBusinessFeatures(undefined), { newOfferWizard: false, leadForm: false, selections: false });
assert.deepEqual(parseBusinessFeatures("x"), { newOfferWizard: false, leadForm: false, selections: false });
assert.deepEqual(parseBusinessFeatures([true]), { newOfferWizard: false, leadForm: false, selections: false });
assert.deepEqual(parseBusinessFeatures({ newOfferWizard: "true", leadForm: 1, selections: true }), {
  newOfferWizard: false,
  leadForm: false,
  selections: true,
});
// Неизвестные ключи отбрасываются при чтении
assert.deepEqual(Object.keys(parseBusinessFeatures({ other: true })).sort(), ["leadForm", "newOfferWizard", "selections"]);

assert.equal(isBusinessFeatureEnabled({ features: { newOfferWizard: true } }, "newOfferWizard"), true);
assert.equal(isBusinessFeatureEnabled({ features: {} }, "newOfferWizard"), false);
assert.equal(isBusinessFeatureEnabled(null, "leadForm"), false);

// merge сохраняет остальные и неизвестные ключи
assert.deepEqual(mergeBusinessFeatures({ leadForm: true, future: 1 }, { newOfferWizard: true }), {
  leadForm: true,
  future: 1,
  newOfferWizard: true,
});
assert.deepEqual(mergeBusinessFeatures(null, { selections: false }), { selections: false });

// patch: только известные ключи с boolean
assert.deepEqual(parseBusinessFeaturesPatch({ leadForm: true }), { leadForm: true });
assert.equal(parseBusinessFeaturesPatch({}), null);
assert.equal(parseBusinessFeaturesPatch({ leadForm: "yes" }), null);
assert.equal(parseBusinessFeaturesPatch({ unknown: true }), null);
assert.equal(parseBusinessFeaturesPatch(null), null);

console.log("businessFeatures.test.ts: ok");

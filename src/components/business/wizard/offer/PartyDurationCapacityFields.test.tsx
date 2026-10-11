import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDefaultFormData } from "./defaults";
import { Step2Placements } from "./steps/Step2Placements";
import { Step4Conditions } from "./steps/Step4Conditions";
import {
  PARTY_DURATION_PRESETS,
  PartyDurationCapacityFields,
} from "./components/PartyDurationCapacityFields";

function render(durationMinutes: number | null, minChildren: number | null, maxChildren: number | null) {
  const details = {
    ...getDefaultFormData(null).birthdayDetails,
    durationMinutes,
    minChildren,
    maxChildren,
  };
  return renderToStaticMarkup(
    createElement(PartyDurationCapacityFields, {
      details,
      onChange: () => undefined,
      isEditable: true,
      idPrefix: "test-party",
    }),
  );
}

assert.deepEqual(PARTY_DURATION_PRESETS, [60, 90, 120, 180, 240]);
const initial = render(null, null, null);
for (const minutes of PARTY_DURATION_PRESETS) {
  assert.ok(initial.includes(`${minutes} мин`), `Choice ${minutes} minutes is available`);
}
assert.ok(initial.includes("Своя"));
assert.ok(initial.includes('class="grid grid-cols-2 gap-3"'), "Children are in one two-column row");
assert.ok(initial.includes("Количество детей"));
assert.ok(initial.includes("Минимум"));
assert.ok(initial.includes("Максимум"));
assert.ok(!initial.includes("Сколько минут?"), "No extra text input for presets");

const preset = render(120, 5, 12);
assert.ok(preset.includes('aria-pressed="true"'), "Preset is selected on edit");
assert.ok(preset.includes('value="5"'));
assert.ok(preset.includes('value="12"'));

const custom = render(150, 7, 20);
assert.ok(custom.includes("Сколько минут?"), "Existing custom value remains editable");
assert.ok(custom.includes('value="150"'));
assert.ok(custom.includes('value="7"'));

const invalid = render(90, 20, 5);
assert.ok(invalid.includes("Минимальное количество не должно превышать максимальное"));
assert.ok(!render(90, 5, 20).includes("Минимальное количество не должно превышать максимальное"));
for (const productType of ["PARTY_PACKAGE", "PARTY_SERVICE"] as const) {
  const data = getDefaultFormData("test-place");
  data.productType = productType;
  data.birthdayDetails.durationMinutes = 90;
  data.requestedPlacements = ["BIRTHDAY"];
  const component = productType === "PARTY_PACKAGE" ? Step2Placements : Step4Conditions;
  const html = renderToStaticMarkup(createElement(component, {
    data,
    onChange: () => undefined,
    isEditable: true,
  }));
  assert.ok(html.includes("Количество детей"), `${productType}: compact children group`);
  assert.ok(html.includes("90 мин"), `${productType}: duration presets in actual wizard step`);
  assert.ok(html.includes("Своя"), `${productType}: custom duration in actual wizard step`);
}
console.log("Party duration/capacity render tests passed");

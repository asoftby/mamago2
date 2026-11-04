import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getDefaultFormData } from "./defaults";
import { Step2Placements } from "./steps/Step2Placements";
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
  const html = renderToStaticMarkup(createElement(Step2Placements, {
    data,
    onChange: () => undefined,
    isEditable: true,
  }));
  assert.ok(html.includes("Количество детей"), `${productType}: compact children group`);
  assert.ok(html.includes("90 мин"), `${productType}: duration presets in actual wizard step`);
  assert.ok(html.includes("Своя"), `${productType}: custom duration in actual wizard step`);
}

for (const [category, locationText, duration, children] of [
  ["CAKE", "Как получить заказ?", false, false],
  ["FOOD", "Как получить заказ?", false, false],
  ["DECOR", "Где проходит?", false, false],
  ["PHOTO", "Где проходит съёмка?", true, false],
  ["ANIMATOR", "Где проходит?", true, true],
  ["VENUE", "Где проходит?", true, true],
  ["SHOW", "Где проходит?", true, true],
  ["MASTER_CLASS", "Где проходит?", true, true],
  ["PROGRAM", "Где проходит?", true, true],
  ["OTHER", "Где проходит?", true, true],
] as const) {
  const data = getDefaultFormData("test-place");
  data.productType = "PARTY_SERVICE";
  data.partyCategory = category;
  data.requestedPlacements = ["BIRTHDAY"];
  const html = renderToStaticMarkup(createElement(Step2Placements, {
    data, onChange: () => undefined, isEditable: true, v2: true,
  }));
  assert.ok(html.includes(locationText), `${category}: contextual location question`);
  assert.ok(!html.includes("Какая услуга?"), `${category}: V2 does not repeat the category selected on step 1`);
  assert.equal(html.includes("Продолжительность"), duration, `${category}: duration relevance`);
  assert.equal(html.includes("Количество детей"), children, `${category}: children relevance`);
  if (category === "CAKE" || category === "FOOD") {
    assert.ok(html.includes("Самовывоз") && html.includes("Доставка"), `${category}: fulfilment choices`);
    assert.ok(html.includes("Что входит в заказ?"), `${category}: understandable included label`);
  }
}
// A hidden category-specific field must become editable again if it holds an
// existing persisted value, otherwise the old restriction silently rejects bookings.
for (const category of ["CAKE", "FOOD", "DECOR", "PHOTO"] as const) {
  const base = getDefaultFormData("test-place");
  base.productType = "PARTY_SERVICE";
  base.partyCategory = category;
  base.birthdayDetails.minChildren = 5;
  base.birthdayDetails.maxChildren = 12;
  if (category !== "PHOTO") base.birthdayDetails.durationMinutes = 90;
  const html = renderToStaticMarkup(createElement(Step2Placements, {
    data: base, onChange: () => undefined, isEditable: true, v2: true,
  }));
  assert.ok(html.includes("Количество детей"), `${category}: saved child count is editable`);
  assert.ok(html.includes('value="5"') && html.includes('value="12"'), `${category}: saved child count remains visible`);
  assert.ok(html.includes("Сохранённые ограничения"), `${category}: notice explains retained restrictions`);
  if (category !== "PHOTO") {
    assert.ok(html.includes("Продолжительность") && html.includes("90 мин"), `${category}: previously entered duration is editable`);
  }
}
// A partial saved range still needs to be editable, not just a fully populated one.
{
  const base = getDefaultFormData("test-place");
  base.productType = "PARTY_SERVICE";
  base.partyCategory = "CAKE";
  base.birthdayDetails.maxChildren = 15;
  const html = renderToStaticMarkup(createElement(Step2Placements, {
    data: base, onChange: () => undefined, isEditable: true, v2: true,
  }));
  assert.ok(html.includes("Количество детей") && html.includes('value="15"'));
}
{
  const data = getDefaultFormData("test-place");
  data.productType = "PARTY_SERVICE";
  data.partyCategory = null;
  const html = renderToStaticMarkup(createElement(Step2Placements, {
    data, onChange: () => undefined, isEditable: true, v2: true,
  }));
  assert.ok(html.includes("Какая услуга?"), "Unknown legacy categories retain the type fallback");
}
console.log("Party duration/capacity render tests passed");

import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Step1Type } from "./steps/Step1Type";
import type { OfferFormData, OfferProductType } from "./types";

function render(productType: OfferProductType | null) {
  return renderToStaticMarkup(
    createElement(Step1Type, {
      data: { productType } as OfferFormData,
      onChange: () => undefined,
      isEditable: true,
    }),
  );
}

const empty = render(null);
for (const title of [
  "Посещение места",
  "Занятия и мастер-классы",
  "Дни рождения и праздники",
  "Лагеря и каникулы",
]) {
  assert.ok(empty.includes(title), `Visible creation category: ${title}`);
}
assert.equal((empty.match(/aria-pressed=/g) ?? []).length, 4, "Only four first choices");
assert.ok(!empty.includes("Persisted-тип"));

for (const [type, extraButtons] of [
  ["PLACE_VISIT", 0],
  ["ONE_TIME_ACTIVITY", 2],
  ["REGULAR_ACTIVITY", 2],
  ["CAMP", 0],
  ["PARTY_SERVICE", 2],
  ["PARTY_PACKAGE", 2],
] as const) {
  const html = render(type);
  assert.equal(
    (html.match(/aria-pressed=/g) ?? []).length,
    4 + extraButtons,
    `Editing ${type} reveals the right contextual choices`,
  );
}
console.log("Offer first-step render tests passed");

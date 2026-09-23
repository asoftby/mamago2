import assert from "node:assert/strict";
import {
  buildPlanCardPresentation,
  formatPlanCardAge,
  formatPlanCardPrice,
  resolvePlanCardLocation,
} from "./planPagePresentation";

assert.equal(formatPlanCardAge(36, "3–5 лет, 5–7 лет"), "3+");
assert.equal(
  formatPlanCardAge(null, "0–1 год, 1–3 года, 3–5 лет, 5–7 лет, #nokids"),
  "0+",
);
assert.equal(formatPlanCardAge(null, "#nokids"), "18+");
assert.equal(formatPlanCardPrice({ priceFrom: 25, priceText: "25 BYN", currency: "BYN" }), "от 25 BYN");
assert.equal(formatPlanCardPrice({ priceFrom: 0, priceText: null, currency: "BYN" }), "бесплатно");
assert.equal(formatPlanCardPrice({ priceFrom: null, priceText: "уточняйте", currency: null }), "уточняйте");

assert.deepEqual(
  resolvePlanCardLocation({
    venue: {
      title: "Небо.Река",
      addressLine: "ул. Октябрьская, 16",
      place: null,
    },
    place: null,
  }),
  { venueName: "Небо.Река", venueAddress: "ул. Октябрьская, 16" },
);

assert.deepEqual(
  buildPlanCardPresentation({
    ageMinMonths: 84,
    ageLabel: "7–9 лет",
    priceFrom: 18,
    priceText: null,
    currency: "BYN",
    venue: null,
    place: {
      title: "Музей",
      shortAddress: "пр-т Независимости, 25",
      formattedAddr: null,
      customAddress: null,
    },
  }),
  {
    ageLabel: "7+",
    priceLabel: "от 18 BYN",
    venueName: "Музей",
    venueAddress: "пр-т Независимости, 25",
  },
);

console.log("planPagePresentation tests: OK");

import assert from "node:assert/strict";
import { test } from "node:test";
import { selectPartyTariff } from "./partyTariffSelection";

const interval = { startAt: "2026-12-07T09:00:00Z", endAt: "2026-12-07T10:00:00Z" };
const conditions = {
  durationMinutes: 60, dateFrom: "2026-12-01", dateTo: "2026-12-31", weekdays: [1],
  startMinutes: 720, endMinutes: 780, minAgeMonths: 60, maxAgeMonths: 96, minGuests: 5,
  componentIds: ["a", "b"],
};
const context = { interval, guests: 5, age: { min: 72, max: 83 }, componentIds: ["b", "a"] };

test("selects the cheapest complete tariff without combining incompatible variants", () => {
  const items = [
    { price: 5, partyConditions: { ...conditions, maxGuests: 4, minGuests: 0 } },
    { price: 10, partyConditions: { ...conditions, componentIds: ["a"] } },
    { price: 15, partyConditions: { ...conditions, weekdays: [2] } },
    { price: 20, partyConditions: { ...conditions, startMinutes: 721 } },
    { price: 25, partyConditions: { ...conditions, dateTo: "2026-12-06" } },
    { price: 30, partyConditions: { ...conditions, durationMinutes: 120 } },
    { price: 50, partyConditions: conditions },
    { price: 40, partyConditions: conditions },
  ];
  assert.equal(selectPartyTariff({ ...context, items }), "40.00");
  assert.equal(selectPartyTariff({ ...context, items: [...items].reverse() }), "40.00");
  assert.equal(selectPartyTariff({ ...context, age: undefined, items }), null);
  assert.equal(selectPartyTariff({ ...context, items: [{ price: 0 }] }), null);
});

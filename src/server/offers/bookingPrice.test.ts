import assert from "node:assert/strict";
import test from "node:test";
import { calculateBookingPrice, BookingPriceError, kopeks } from "./bookingPrice";

const optional = { id: "o", title: "Decor", mode: "OPTIONAL" as const,
  priceByn: "25.50", active: true, bookingUnitId: null };
const included = { id: "i", title: "Included game", mode: "INCLUDED" as const,
  priceByn: "0.00", active: true, bookingUnitId: null };
const base = { currency: "BYN", seats: 1, durationMinutes: 60, basePriceByn: "100.00",
  tariff: null, options: [optional, included] };

test("base + selected optional, automatically included items; integer kopeks", () => {
  const { snapshot } = calculateBookingPrice({ ...base, selectedOptionIds: ["o"] });
  assert.equal(snapshot.status, "FIXED");
  assert.equal(snapshot.totalByn, "125.50");
  assert.deepEqual(snapshot.options.map(x => x.id), ["o", "i"]);
  assert.equal(snapshot.options.find(x => x.id === "i")?.amountByn, "0.00");
  assert.equal(snapshot.version, 1);
});

test("excluded optional is never charged", () => {
  const { snapshot } = calculateBookingPrice(base);
  assert.equal(snapshot.totalByn, "100.00");
  assert.deepEqual(snapshot.options.map(x => x.id), ["i"]);
});

test("class tariff is authoritative over base offer price", () => {
  const { snapshot } = calculateBookingPrice({
    ...base, tariff: { id: "tariff-1", title: "8 visits", price: "80,50 BYN", unit: "8 занятий" },
  });
  assert.equal(snapshot.totalByn, "80.50");
  assert.equal(snapshot.basis, "CLASS_TARIFF");
  assert.equal(snapshot.base.unit, "8 занятий");
});

test("a multi-seat package has no invented per-person total", () => {
  const { snapshot } = calculateBookingPrice({
    ...base, seats: 2,
    tariff: { id: "monthly", title: "Month", price: "100", unit: "месяц" },
  });
  assert.equal(snapshot.status, "QUOTE_REQUIRED");
  assert.equal(snapshot.totalByn, null);
});

test("unpriced offer stays quote-required despite priced add-on", () => {
  const { snapshot } = calculateBookingPrice({
    ...base, basePriceByn: null, selectedOptionIds: ["o"],
  });
  assert.equal(snapshot.status, "QUOTE_REQUIRED");
  assert.equal(snapshot.base.amountByn, null);
  assert.equal(snapshot.totalByn, null);
  assert.equal(snapshot.options[0].amountByn, "25.50");
});

test("resource-linked option returns server-derived resource set", () => {
  const { optionUnitIds } = calculateBookingPrice({
    ...base, options: [{ ...optional, bookingUnitId: "shared-projector" }, included],
    selectedOptionIds: ["o"],
  });
  assert.deepEqual(optionUnitIds, ["shared-projector"]);
});

test("reject inactive, standalone, unknown or duplicated selections", () => {
  const standalone = { ...optional, id: "standalone", mode: "STANDALONE" as const };
  for (const item of [
    { ...base, selectedOptionIds: ["o", "o"] },
    { ...base, selectedOptionIds: ["missing"] },
    { ...base, options: [{ ...optional, active: false }], selectedOptionIds: ["o"] },
    { ...base, options: [standalone], selectedOptionIds: ["standalone"] },
    { ...base, options: [{ ...included, priceByn: "20" }] },
  ]) {
    assert.throws(() => calculateBookingPrice(item), BookingPriceError);
  }
});

test("non-BYN options and malformed or negative money fail closed", () => {
  assert.throws(() => calculateBookingPrice({ ...base, currency: "EUR",
    selectedOptionIds: ["o"] }), BookingPriceError);
  for (const v of ["-1", "10.005", "100abc", "1e3", "99999999999"]) {
    assert.equal(kopeks(v), null);
  }
  assert.equal(kopeks("9,99 руб."), 999);
  assert.equal(kopeks("0"), 0);
});

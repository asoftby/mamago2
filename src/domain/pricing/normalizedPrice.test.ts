import assert from "node:assert/strict";
import test from "node:test";
import { normalizePublicationPrice, parseSafeLegacyPriceText } from "./normalizedPrice";

test("normalizes explicit free, exact, from and range modes", () => {
  assert.deepEqual(normalizePublicationPrice({ mode: "FREE" }), { mode: "FREE", min: 0, max: 0, currency: "BYN", source: "NUMERIC", conflict: null });
  assert.equal(normalizePublicationPrice({ mode: "EXACT", min: 30 }).max, 30);
  assert.equal(normalizePublicationPrice({ mode: "EXACT", min: 0 }).mode, "FREE");
  assert.equal(normalizePublicationPrice({ mode: "FROM", min: 30 }).max, null);
  assert.deepEqual(normalizePublicationPrice({ mode: "RANGE", min: 30, max: 120 }).mode, "RANGE");
  assert.deepEqual(normalizePublicationPrice({ mode: "NONE" }), { mode: "NONE", min: null, max: null, currency: "BYN", source: "NONE", conflict: null });
});

test("explicit FREE and NONE override stale structured tariffs", () => {
  const staleTariffs = { items: [{ price: "30" }, { price: "120" }] };

  assert.deepEqual(normalizePublicationPrice({ mode: "FREE", priceItems: staleTariffs }), {
    mode: "FREE",
    min: 0,
    max: 0,
    currency: "BYN",
    source: "NUMERIC",
    conflict: null,
  });
  assert.deepEqual(normalizePublicationPrice({ mode: "NONE", priceItems: staleTariffs }), {
    mode: "NONE",
    min: null,
    max: null,
    currency: "BYN",
    source: "NONE",
    conflict: null,
  });
});

test("structured tariffs are authoritative over numeric fallback and ignore invalid entries", () => {
  const price = normalizePublicationPrice({ min: 999, priceItems: { items: [{ price: "30" }, { price: "bad" }, { price: 120 }] } });
  assert.deepEqual({ mode: price.mode, min: price.min, max: price.max, source: price.source }, { mode: "RANGE", min: 30, max: 120, source: "STRUCTURED" });
});

test("rejects invalid ranges", () => {
  assert.equal(normalizePublicationPrice({ mode: "RANGE", min: 120, max: 30 }).conflict, "max-less-than-min");
});

test("safely parses unambiguous legacy text", () => {
  assert.equal(parseSafeLegacyPriceText("бесплатно").mode, "FREE");
  assert.deepEqual(parseSafeLegacyPriceText("30 руб."), { mode: "EXACT", min: 30, max: 30, currency: "BYN", source: "TEXT", conflict: null });
  assert.equal(parseSafeLegacyPriceText("от 30 руб.").mode, "FROM");
  assert.equal(parseSafeLegacyPriceText("30–120 руб.").mode, "RANGE");
  assert.equal(parseSafeLegacyPriceText("цена зависит от программы").mode, "UNKNOWN");
});

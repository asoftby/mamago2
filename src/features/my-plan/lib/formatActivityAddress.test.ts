import assert from "node:assert/strict";
import { formatActivityAddressLine, resolveActivityAddress } from "./formatActivityAddress";

assert.equal(formatActivityAddressLine(null), null, "no activity -> no address");

assert.equal(
  formatActivityAddressLine({
    place: {
      shortAddress: "пр-т Машерова, 15/1",
      formattedAddr: null,
      customAddress: null,
      city: { name: "Минск" },
    },
    venue: null,
  }),
  "Минск, пр-т Машерова, 15/1",
  "city + street from place.shortAddress",
);

assert.equal(
  formatActivityAddressLine({
    place: null,
    venue: { addressLine: "ул. Мстиславца, 22", place: { shortAddress: null, formattedAddr: null, customAddress: null, city: { name: "Минск" } } },
  }),
  "Минск, ул. Мстиславца, 22",
  "falls back to venue.addressLine + venue.place.city when no direct place",
);

assert.equal(
  formatActivityAddressLine({
    place: { shortAddress: null, formattedAddr: null, customAddress: null, city: null },
    venue: null,
  }),
  null,
  "no usable address data anywhere -> null, never a fabricated fallback",
);

assert.equal(
  formatActivityAddressLine({
    place: { shortAddress: null, formattedAddr: "Минская обл., ...", customAddress: null, city: null },
    venue: null,
  }),
  "Минская обл., ...",
  "formattedAddr used only as last resort",
);

// ── resolveActivityAddress: structured city/street/metro ──

assert.deepEqual(
  resolveActivityAddress(null),
  { cityLabel: null, streetAddressLabel: null, metroLabel: null },
  "no activity -> all labels null",
);

// Raw stored address with a "г.<city>" prefix and a metro parenthetical
// baked into the same free-text field — must decompose into city, street
// (metro noise stripped, never fabricated into a text-extracted metro
// label), and a metro label sourced ONLY from the structured relation.
assert.deepEqual(
  resolveActivityAddress({
    place: {
      shortAddress: "г.Минск, ул. П.Мстиславца, 22 (ст.м.Восток)",
      formattedAddr: null,
      customAddress: null,
      city: { name: "Минск" },
      metroAuto: { name: "Восток" },
      metroManual: null,
    },
    venue: null,
  }),
  { cityLabel: "Минск", streetAddressLabel: "ул. П.Мстиславца, 22", metroLabel: "м. Восток" },
  "city + metro parenthetical stripped from street; metro sourced structurally, not parsed from text",
);

// Street-then-city raw order, no "г." token — city still separated out and
// not duplicated in the street label.
assert.deepEqual(
  resolveActivityAddress({
    place: {
      shortAddress: "проспект Машерова 15/1, Минск",
      formattedAddr: null,
      customAddress: null,
      city: { name: "Минск" },
    },
    venue: null,
  }),
  { cityLabel: "Минск", streetAddressLabel: "проспект Машерова 15/1", metroLabel: null },
  "trailing redundant city stripped from street; no metro relation -> metro omitted, never guessed from text",
);

// Structured metro present but not mentioned anywhere in the raw address
// text at all — still surfaced, since it comes from the relation, not text.
assert.deepEqual(
  resolveActivityAddress({
    place: {
      shortAddress: "ул. Немига, 5",
      formattedAddr: null,
      customAddress: null,
      city: { name: "Минск" },
      metroAuto: null,
      metroManual: { name: "Немига" },
    },
    venue: null,
  }),
  { cityLabel: "Минск", streetAddressLabel: "ул. Немига, 5", metroLabel: "м. Немига" },
  "metroManual used when metroAuto absent",
);

// Missing city and missing street -> both omitted, nothing fabricated.
assert.deepEqual(
  resolveActivityAddress({
    place: { shortAddress: null, formattedAddr: null, customAddress: null, city: null },
    venue: null,
  }),
  { cityLabel: null, streetAddressLabel: null, metroLabel: null },
  "no usable data anywhere -> every label null, never guessed",
);

console.log("formatActivityAddressLine tests: OK");

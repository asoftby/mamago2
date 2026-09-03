import * as assert from "node:assert/strict";

import { buildGeoFilterOptions, getGeoFieldPresentation } from "./placeLocationPresentation";

const DISTRICT_UNAVAILABLE_COPY = "Список районов для этого города пока недоступен.";
const METRO_UNAVAILABLE_COPY = "Список станций метро для этого города пока недоступен.";

// ── auto district presentation ───────────────────────────────────────────────────
{
  const presentation = getGeoFieldPresentation({
    manualId: null,
    autoId: "district-1",
    optionsAvailable: true,
    unavailableCopy: DISTRICT_UNAVAILABLE_COPY,
  });
  assert.equal(presentation.mode, "auto");
  assert.equal(presentation.statusCopy, "Определено автоматически");
  assert.equal(presentation.resetLabel, null, "auto-only state has no reset action — the field IS the source of truth");
}

// ── manual district → "Изменено вручную" + "Вернуть автоматически" ──────────────
{
  const presentation = getGeoFieldPresentation({
    manualId: "district-2",
    autoId: "district-1",
    optionsAvailable: true,
    unavailableCopy: DISTRICT_UNAVAILABLE_COPY,
  });
  assert.equal(presentation.mode, "manual");
  assert.equal(presentation.statusCopy, "Изменено вручную");
  assert.equal(
    presentation.resetLabel,
    "Вернуть автоматически",
    "an auto value exists to fall back to, so the action offers to return to it",
  );
}

// ── manual district без auto → "Очистить выбор" ──────────────────────────────────
{
  const presentation = getGeoFieldPresentation({
    manualId: "district-2",
    autoId: null,
    optionsAvailable: true,
    unavailableCopy: DISTRICT_UNAVAILABLE_COPY,
  });
  assert.equal(presentation.mode, "manual");
  assert.equal(presentation.statusCopy, "Изменено вручную");
  assert.equal(
    presentation.resetLabel,
    "Очистить выбор",
    "no auto value to fall back to, so the action just clears the manual pick",
  );
}

// ── auto metro + distance (distance itself is composed by the caller) ───────────
{
  const presentation = getGeoFieldPresentation({
    manualId: null,
    autoId: "metro-1",
    optionsAvailable: true,
    unavailableCopy: METRO_UNAVAILABLE_COPY,
  });
  assert.equal(presentation.mode, "auto");
  assert.equal(presentation.statusCopy, "Определено автоматически");
}

// ── manual metro + manual distance ────────────────────────────────────────────────
{
  const presentation = getGeoFieldPresentation({
    manualId: "metro-2",
    autoId: "metro-1",
    optionsAvailable: true,
    unavailableCopy: METRO_UNAVAILABLE_COPY,
  });
  assert.equal(presentation.mode, "manual");
  assert.equal(presentation.statusCopy, "Изменено вручную");
  assert.equal(presentation.resetLabel, "Вернуть автоматически");
}

// ── no auto, options available → "выберите при необходимости" ───────────────────
{
  const presentation = getGeoFieldPresentation({
    manualId: null,
    autoId: null,
    optionsAvailable: true,
    unavailableCopy: DISTRICT_UNAVAILABLE_COPY,
  });
  assert.equal(presentation.mode, "unmatched");
  assert.equal(
    presentation.statusCopy,
    "Не удалось определить автоматически — выберите при необходимости",
  );
  assert.equal(presentation.resetLabel, null);
}

// ── options unavailable → caller-supplied human copy, no technical wording ──────
{
  const presentation = getGeoFieldPresentation({
    manualId: null,
    autoId: null,
    optionsAvailable: false,
    unavailableCopy: DISTRICT_UNAVAILABLE_COPY,
  });
  assert.equal(presentation.mode, "unavailable");
  assert.equal(presentation.statusCopy, DISTRICT_UNAVAILABLE_COPY);
  assert.equal(presentation.resetLabel, null);

  // No technical terms ("cityId", "справочник") leak into user-facing copy.
  for (const forbidden of ["cityId", "справочник", "справочники"]) {
    assert.ok(
      !presentation.statusCopy.toLowerCase().includes(forbidden.toLowerCase()),
      `field status copy must not contain the technical term "${forbidden}"`,
    );
  }
}

// A manual pick always wins over "unavailable options" — an already-saved
// manual value must keep displaying even if the reference list later fails
// to load (e.g. a flaky districts fetch on a subsequent render).
{
  const presentation = getGeoFieldPresentation({
    manualId: "district-2",
    autoId: null,
    optionsAvailable: false,
    unavailableCopy: DISTRICT_UNAVAILABLE_COPY,
  });
  assert.equal(presentation.mode, "manual");
  assert.equal(presentation.statusCopy, "Изменено вручную");
  assert.equal(presentation.resetLabel, "Очистить выбор");
}

// ── buildGeoFilterOptions ─────────────────────────────────────────────────────────
// Shared by the district and metro FilterSelects — must keep an already-saved
// value's readable name visible even when its reference list hasn't loaded.

// Existing saved district/metro + empty reference list + readable fallback
// name → the readable option is present (not a raw id, not a blank select).
{
  const options = buildGeoFilterOptions({
    shownId: "district-1",
    referenceList: [],
    fallbackName: "Центральный",
  });
  assert.deepEqual(options, [{ value: "district-1", label: "Центральный" }]);
}

// The raw id must never become the label — the human name is always used
// when a fallback name is known.
{
  const options = buildGeoFilterOptions({
    shownId: "cmqpohiyt006fwss63n2p2jti",
    referenceList: [],
    fallbackName: "Центральный",
  });
  assert.equal(options.length, 1);
  assert.equal(options[0].value, "cmqpohiyt006fwss63n2p2jti");
  assert.notEqual(
    options[0].label,
    "cmqpohiyt006fwss63n2p2jti",
    "the raw database id must never be used as the option's display label",
  );
  assert.equal(options[0].label, "Центральный");
}

// No fallback name known (e.g. a brand-new place, nothing saved yet) and the
// reference list is empty → no options at all, never a raw id either.
{
  const options = buildGeoFilterOptions({
    shownId: null,
    referenceList: [],
    fallbackName: undefined,
  });
  assert.deepEqual(options, []);
}

// A shownId with no fallback name available still doesn't leak the raw id —
// there is simply nothing to show yet.
{
  const options = buildGeoFilterOptions({
    shownId: "district-1",
    referenceList: [],
    fallbackName: null,
  });
  assert.deepEqual(options, []);
}

// Normal case: the reference list has loaded → its real entries are used
// as-is, unaffected by the fallback (which only fills the gap while the
// list hasn't loaded).
{
  const options = buildGeoFilterOptions({
    shownId: "district-1",
    referenceList: [
      { id: "district-1", name: "Центральный" },
      { id: "district-2", name: "Октябрьский" },
    ],
    fallbackName: "Центральный",
  });
  assert.deepEqual(options, [
    { value: "district-1", label: "Центральный" },
    { value: "district-2", label: "Октябрьский" },
  ]);
}

console.log("placeLocationPresentation tests: OK");

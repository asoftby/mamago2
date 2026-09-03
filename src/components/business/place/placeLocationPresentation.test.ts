import * as assert from "node:assert/strict";

import { getGeoFieldPresentation } from "./placeLocationPresentation";

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

console.log("placeLocationPresentation tests: OK");

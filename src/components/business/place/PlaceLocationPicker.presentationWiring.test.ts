/**
 * Static wiring regression for the Step 2 "Location" UX cleanup.
 *
 * PlaceLocationPicker is a client component that can't be mounted in this
 * repo's plain-tsx test harness (no jsdom/RTL — see the same note in
 * PlaceLocationPicker.raceContract.test.ts and
 * src/app/(public)/blog/[slug]/page.test.ts). This file proves, from the
 * source, that:
 *   1. the duplicate "auto-enrichment" card is gone — the district/metro
 *      selects are the only source of truth;
 *   2. no technical jargon (cityId, справочник) leaks into user-facing copy;
 *   3. the district/metro fields are wired through the new pure presentation
 *      helper, not a parallel inline ternary tree;
 *   4. every #162 correctness helper this task must not touch is still
 *      imported and used exactly as before.
 *
 * Запуск: npx tsx src/components/business/place/PlaceLocationPicker.presentationWiring.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./PlaceLocationPicker.tsx", import.meta.url),
  "utf8",
);

// ── 1. No duplicate "auto-enrichment" card ───────────────────────────────────────
assert.doesNotMatch(
  source,
  /Определено автоматически<\/h4>/,
  "the standalone blue 'Определено автоматически' card must be removed — status now lives only under each select",
);
assert.doesNotMatch(
  source,
  /showReadOnlyEnrichment/,
  "the flag that gated the removed duplicate card must not reappear",
);
assert.doesNotMatch(
  source,
  /hasAutoEnrichment/,
  "the now-unused hasAutoEnrichment computed value must not reappear",
);
// The status copy itself now lives ONLY in placeLocationPresentation.ts,
// read through districtPresentation/metroStatusCopy — it must not be
// hardcoded a second time anywhere in this file (that would be exactly the
// old card-vs-field duplication, just moved rather than removed).
assert.doesNotMatch(
  source,
  /Определено автоматически/,
  "the status copy must not be hardcoded in PlaceLocationPicker.tsx — it must come only from getGeoFieldPresentation()",
);

// ── 2. No technical jargon in user-facing copy ───────────────────────────────────
// "cityId" itself is a legitimate identifier throughout this file (state,
// props, query params) — only check it never appears as rendered TEXT, the
// same way "справочник" (which has no legitimate identifier use here) is
// banned outright.
for (const forbidden of ["справочник", "справочника", "справочники"]) {
  assert.ok(
    !source.includes(forbidden),
    `no technical term "${forbidden}" may appear anywhere in PlaceLocationPicker.tsx`,
  );
}
assert.doesNotMatch(
  source,
  /отсутствует cityId/,
  "the old technical cityId-missing message must be gone",
);
// A blanket "cityId must never appear between > and <" regex is too broad for
// a whole-file match — TS type/interface declarations and arrow functions
// (`=>`) litter the file with `>` characters unrelated to JSX text, so it
// false-positives on e.g. `type GeoOptionsDebugState = { cityId: string; ... }`.
// Scope the check to the actual JSX returned by the component instead.
{
  const returnStart = source.indexOf("\n  return (\n");
  assert.ok(returnStart !== -1, "could not locate the component's JSX return block");
  const jsx = source.slice(returnStart);
  assert.doesNotMatch(
    jsx,
    />\s*[^<{]*cityId[^<]*</,
    "\"cityId\" must never appear as literal rendered JSX text (identifiers/props inside {} are fine, user-facing text is not)",
  );
}
assert.match(
  source,
  /Район и метро сохранены/,
  "the cityId-missing fallback must use the human-friendly 'saved, can't edit now' copy",
);
assert.doesNotMatch(
  source,
  /\{districtManualId \|\| districtAutoId\}/,
  "the cityId-missing fallback must not render a raw database id as its primary text",
);

// ── 3. District/metro wired through the shared presentation helper ──────────────
assert.match(
  source,
  /import \{ getGeoFieldPresentation \} from "\.\/placeLocationPresentation";/,
);
assert.match(source, /const districtPresentation = getGeoFieldPresentation\(\{/);
assert.match(source, /const metroPresentation = getGeoFieldPresentation\(\{/);
assert.match(
  source,
  /\{districtPresentation\.statusCopy\}/,
  "the district field's status line must come from the shared presentation helper",
);
assert.match(
  source,
  /\{metroStatusCopy\}/,
  "the metro field's status line (distance + status) must come from the derived metroStatusCopy",
);

// ── 4. #162 correctness contract untouched — every listed helper is still
//       imported AND used, none moved/renamed/inlined ───────────────────────────
const requiredCorrectnessSymbols = [
  "shouldClearManualGeoOverrides",
  "buildLocationTransitionPatch",
  "enrichmentRequestSeqRef",
  "isStaleEnrichmentResponse",
  "computeManualMetroDistanceM",
];
for (const symbol of requiredCorrectnessSymbols) {
  const occurrences = source.split(symbol).length - 1;
  assert.ok(
    occurrences >= 2,
    `"${symbol}" must still be both imported/declared and used at least once (found ${occurrences} occurrence(s))`,
  );
}

// enrichLocation must still never reference manual-override state — this
// mirrors the assertion already made in PlaceLocationPicker.raceContract
// .test.ts; repeated here because this file specifically guards against the
// presentation refactor accidentally reintroducing it.
{
  const start = source.indexOf("const enrichLocation = async (");
  const end = source.indexOf("const checkForDuplicates = async () => {", start);
  assert.ok(start !== -1 && end !== -1);
  const enrichLocationBody = source.slice(start, end);
  for (const forbidden of [
    "setDistrictManualId(null)",
    "setMetroManualId(null)",
    "setMetroManualDistanceM(null)",
  ]) {
    assert.ok(
      !enrichLocationBody.includes(forbidden),
      `enrichLocation must still never reference "${forbidden}"`,
    );
  }
}

// handleResetMetro must still send both fields as explicit nulls in one patch.
assert.match(
  source,
  /onUpdate\?\.\(\{ metroManualId: null, metroManualDistanceM: null \}\)/,
  "handleResetMetro's onUpdate patch contract (#162) must be unchanged",
);

console.log("PlaceLocationPicker Step 2 presentation wiring: OK");

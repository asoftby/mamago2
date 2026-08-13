/**
 * Guards the Google Maps / Places config contract for the new (post-March-2025)
 * Google Cloud project used by mamaGo:
 *
 *  1. Every map component must read the canonical NEXT_PUBLIC_GOOGLE_MAP_ID env
 *     var (the one actually set in GitHub Actions / Secrets). A stale
 *     NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID name silently disables Map ID / Advanced
 *     Markers everywhere.
 *  2. Release-critical Places search inputs must never reintroduce the legacy
 *     google.maps.places.Autocomplete / AutocompleteService / PlacesService
 *     classes, which Google blocks outright for this project ("not available
 *     to new customers" as of March 1, 2025 — LegacyApiNotActivatedMapError).
 *
 * Run: npx tsx src/services/googleMaps/googleMapsConfigContract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..", "..");

function read(relPath: string): string {
  return readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

const MAP_ID_FILES = [
  "src/components/business/place/PlaceMapModal.tsx",
  "src/components/business/place/PlaceMapPreview.tsx",
  "src/components/business/wizard/event/steps/location/EventLocationMapModal.tsx",
  "src/components/business/wizard/event/steps/location/EventLocationMapPreview.tsx",
  "src/components/routes/RouteMapHero.tsx",
];

for (const relPath of MAP_ID_FILES) {
  const content = read(relPath);
  assert.ok(
    content.includes("NEXT_PUBLIC_GOOGLE_MAP_ID"),
    `${relPath} must read the canonical NEXT_PUBLIC_GOOGLE_MAP_ID env var`,
  );
  assert.ok(
    !content.includes("NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID"),
    `${relPath} must not reintroduce the stale NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID env var name`,
  );
}

const NO_LEGACY_PLACES_FILES = [
  "src/components/business/place/PlaceSearchInput.tsx",
  "src/components/routes/RouteStopLocationInput.tsx",
  "src/components/business/wizard/event/steps/location/EventLocationSearchInput.tsx",
];

const LEGACY_PLACES_PATTERNS: RegExp[] = [
  /new\s+[\w.]+\.Autocomplete\(/, // e.g. new placesLib.Autocomplete(input, ...)
  /google\.maps\.places\.Autocomplete\b/,
  /\bAutocompleteService\b/,
  /\bPlacesService\b/,
];

for (const relPath of NO_LEGACY_PLACES_FILES) {
  const content = read(relPath);
  for (const pattern of LEGACY_PLACES_PATTERNS) {
    assert.ok(
      !pattern.test(content),
      `${relPath} must not reintroduce legacy Places API surface matching ${pattern} — blocked for this Google Cloud project since March 2025`,
    );
  }
}

console.log("googleMapsConfigContract.test.ts: OK");

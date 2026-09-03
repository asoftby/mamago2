/**
 * Static wiring regression for the Step 2 "Location" UX cleanup.
 *
 * Step2Location is a client component that can't be mounted in this repo's
 * plain-tsx test harness (no jsdom/RTL). This file proves, from the source,
 * that GoogleReviewsSync is now presented behind an optional collapsible
 * ("Данные Google (необязательно)") without any change to its own props/API
 * — the task explicitly forbids touching GoogleReviewsSync's behavior.
 *
 * Запуск: npx tsx src/components/business/wizard/place/steps/Step2Location.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Step2Location.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /import \{ Collapsible, CollapsibleContent, CollapsibleTrigger \} from "@\/components\/ui\/collapsible";/,
  "GoogleReviewsSync must be wrapped using the existing shared Collapsible primitives",
);
assert.match(
  source,
  /Данные Google \(необязательно\)/,
  "the collapsible trigger must use the required human-friendly label",
);

// GoogleReviewsSync itself must still receive exactly the same props as
// before — only the call site changed (moved inside CollapsibleContent).
const requiredGoogleReviewsSyncProps = [
  "placeId={data.id || null}",
  "placeTitle={data.title}",
  "placeAddress={data.formattedAddr || data.customAddress}",
  "googlePlaceId={data.googlePlaceId}",
  "googleRating={data.googleRating}",
  "googleUserRatingsTotal={data.googleUserRatingsTotal}",
  "googleReviewsSyncedAt={data.googleReviewsSyncedAt}",
  "googleMapsUri={data.googleMapsUri}",
  "googleReviewsJson={data.googleReviewsJson}",
  "onChange={onChange}",
];
for (const prop of requiredGoogleReviewsSyncProps) {
  assert.ok(
    source.includes(prop),
    `GoogleReviewsSync must still receive unchanged prop wiring: ${prop}`,
  );
}

// GoogleReviewsSync must be nested inside CollapsibleContent, not rendered
// as a top-level sibling of PlaceLocationPicker.
{
  const collapsibleStart = source.indexOf("<Collapsible ");
  const googleReviewsSyncStart = source.indexOf("<GoogleReviewsSync");
  const collapsibleContentStart = source.indexOf("<CollapsibleContent>");
  assert.ok(
    collapsibleStart !== -1 &&
      collapsibleContentStart !== -1 &&
      googleReviewsSyncStart > collapsibleContentStart,
    "GoogleReviewsSync must be rendered inside <CollapsibleContent>",
  );
}

// PlaceLocationPicker must still be rendered outside/above the collapsible,
// unaffected by this change.
{
  const pickerStart = source.indexOf("<PlaceLocationPicker");
  const collapsibleStart = source.indexOf("<Collapsible ");
  assert.ok(
    pickerStart !== -1 && pickerStart < collapsibleStart,
    "PlaceLocationPicker must remain rendered before the Google data collapsible",
  );
}

console.log("Step2Location Google data collapsible wiring: OK");

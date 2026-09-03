/**
 * Static wiring regression for the Step 2 "Location" UX cleanup.
 *
 * Step2Location is a client component that can't be mounted in this repo's
 * plain-tsx test harness (no jsdom/RTL). This file proves, from the source,
 * that GoogleReviewsSync is now presented behind an optional "Данные Google
 * (необязательно)" disclosure WITHOUT changing its own props/API or its
 * mount lifecycle.
 *
 * Lifecycle contract: the shared Collapsible primitive
 * (@/components/ui/collapsible) unmounts its children while closed —
 * `if (!open) return null`, see CollapsibleContent — which would stop
 * GoogleReviewsSync's own mount-time effects (its background preview/sync
 * lifecycle) from running until the user opens the block. That's a real
 * behavior change the task forbids. A native <details>/<summary> only
 * toggles visibility (CSS), so GoogleReviewsSync stays mounted — and its
 * effects run on mount — regardless of whether the block is expanded.
 *
 * Запуск: npx tsx src/components/business/wizard/place/steps/Step2Location.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Step2Location.tsx", import.meta.url), "utf8");

// ── 1. The shared Collapsible primitive must NOT be used here — it
//       unmounts children while closed, which would break GoogleReviewsSync's
//       mount-time effects. ──────────────────────────────────────────────────
assert.doesNotMatch(
  source,
  /from "@\/components\/ui\/collapsible"/,
  "the shared Collapsible/CollapsibleContent primitive must not be used — it conditionally unmounts its children (see collapsible.tsx's `if (!open) return null`), which would stop GoogleReviewsSync's mount-time effects from running while collapsed",
);
assert.doesNotMatch(source, /<Collapsible[\s>]/, "no <Collapsible> element");
assert.doesNotMatch(source, /<CollapsibleContent/, "no <CollapsibleContent> element");
assert.doesNotMatch(source, /<CollapsibleTrigger/, "no <CollapsibleTrigger> element");

// ── 2. GoogleReviewsSync is presented via native <details>/<summary> ────────
assert.match(
  source,
  /<details\b/,
  "GoogleReviewsSync must be wrapped in a native <details> element (visibility-only toggle, never unmounts children)",
);
assert.match(source, /<summary\b/, "the disclosure trigger must be a native <summary> element");
assert.match(
  source,
  /Данные Google \(необязательно\)/,
  "the disclosure trigger must use the required human-friendly label",
);

// No React open/close state must gate GoogleReviewsSync's presence — the
// disclosure is purely a native/CSS visibility toggle.
assert.doesNotMatch(
  source,
  /useState/,
  "no useState should be needed — <details> owns its own open/closed state natively",
);

// ── 3. GoogleReviewsSync itself must still receive exactly the same props
//       as before — only the call site (wrapper element) changed. ──────────
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

// ── 4. GoogleReviewsSync must be unconditionally nested inside <details>,
//       not gated behind any JS conditional (`&&`, ternary, `open &&`, etc.)
//       between <details> and the component — i.e. it is always mounted. ───
{
  const detailsStart = source.indexOf("<details");
  const googleReviewsSyncStart = source.indexOf("<GoogleReviewsSync");
  const detailsEnd = source.indexOf("</details>");
  assert.ok(
    detailsStart !== -1 &&
      googleReviewsSyncStart > detailsStart &&
      googleReviewsSyncStart < detailsEnd,
    "GoogleReviewsSync must be rendered inside <details>...</details>",
  );

  const between = source.slice(detailsStart, googleReviewsSyncStart);
  assert.doesNotMatch(
    between,
    /\{[^}]*&&[^}]*$/,
    "GoogleReviewsSync must not be behind a conditional-rendering (`&&`) gate — it must always be mounted, only its visibility toggles",
  );
}

// ── 5. PlaceLocationPicker must still be rendered outside/above the
//       disclosure, unaffected by this change. ─────────────────────────────
{
  const pickerStart = source.indexOf("<PlaceLocationPicker");
  const detailsStart = source.indexOf("<details");
  assert.ok(
    pickerStart !== -1 && pickerStart < detailsStart,
    "PlaceLocationPicker must remain rendered before the Google data disclosure",
  );
}

console.log("Step2Location Google data disclosure lifecycle wiring: OK");

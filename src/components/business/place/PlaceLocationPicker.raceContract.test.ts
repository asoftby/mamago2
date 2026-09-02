/**
 * Static wiring regression for the P1 race-condition fix in
 * PlaceLocationPicker: manual district/metro overrides must be invalidated
 * SYNCHRONOUSLY when a real location move is accepted, and the async
 * enrichLocation() response must never be allowed to touch manual state.
 *
 * PlaceLocationPicker is a client component that can't be mounted in this
 * repo's plain-tsx test harness (no jsdom/RTL here, and its import graph
 * pulls in server-only-guarded modules) — same constraint already
 * documented for src/app/(public)/blog/[slug]/page.test.ts. The pure
 * decision/patch logic itself is covered directly, with mocked-fetch-free
 * unit tests, in placeLocationGeoOverrides.test.ts; this file only proves
 * the component actually WIRES those functions in the required order.
 *
 * Запуск: npx tsx src/components/business/place/PlaceLocationPicker.raceContract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/business/place/PlaceLocationPicker.tsx",
  "utf8",
);

function sliceBetween(startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `expected to find marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `expected to find end marker after start: ${endMarker}`);
  return source.slice(start, end);
}

// ── handlePlaceSelect: location commit must precede enrichment start ────────────
{
  const body = sliceBetween(
    "const handlePlaceSelect = async (data: {",
    "const handleMapConfirm = async (data: {",
  );

  const onUpdateIndex = body.indexOf("onUpdate?.(");
  const enrichCallIndex = body.indexOf("await enrichLocation(");
  assert.notEqual(onUpdateIndex, -1, "handlePlaceSelect must call onUpdate");
  assert.notEqual(enrichCallIndex, -1, "handlePlaceSelect must call enrichLocation");
  assert.ok(
    onUpdateIndex < enrichCallIndex,
    "handlePlaceSelect must commit the location (+ manual reset, if any) to the parent BEFORE starting enrichment, not after",
  );

  // The synchronous clear must happen via the decision helper, not inline duplicated logic.
  assert.match(
    body,
    /shouldClearManualGeoOverrides\(previousPoint, nextPoint\)/,
    "handlePlaceSelect must decide clearing synchronously via shouldClearManualGeoOverrides",
  );
  assert.match(
    body,
    /buildLocationTransitionPatch\(/,
    "handlePlaceSelect must build the parent patch via buildLocationTransitionPatch, so the reset (if any) travels in the same patch as the location fields",
  );
}

// ── handleMapConfirm: same contract ──────────────────────────────────────────────
{
  const body = sliceBetween(
    "const handleMapConfirm = async (data: {",
    "const enrichLocation = async (",
  );

  const onUpdateIndex = body.indexOf("onUpdate?.(");
  const enrichCallIndex = body.indexOf("await enrichLocation(");
  assert.notEqual(onUpdateIndex, -1, "handleMapConfirm must call onUpdate");
  assert.notEqual(enrichCallIndex, -1, "handleMapConfirm must call enrichLocation");
  assert.ok(
    onUpdateIndex < enrichCallIndex,
    "handleMapConfirm must commit the location (+ manual reset, if any) to the parent BEFORE starting enrichment, not after",
  );
  assert.match(
    body,
    /shouldClearManualGeoOverrides\(previousPoint, nextPoint\)/,
    "handleMapConfirm must decide clearing synchronously via shouldClearManualGeoOverrides",
  );
  assert.match(
    body,
    /buildLocationTransitionPatch\(/,
    "handleMapConfirm must build the parent patch via buildLocationTransitionPatch",
  );
}

// ── enrichLocation: must never touch manual state, and must guard staleness ─────
{
  const body = sliceBetween(
    "const enrichLocation = async (",
    "const checkForDuplicates = async () => {",
  );

  for (const forbidden of [
    "setDistrictManualId(null)",
    "setMetroManualId(null)",
    "setMetroManualDistanceM(null)",
    "MANUAL_GEO_OVERRIDE_RESET_PATCH",
  ]) {
    assert.ok(
      !body.includes(forbidden),
      `enrichLocation must never reference "${forbidden}" — manual overrides belong to the synchronous ` +
        `user-interaction layer (handlePlaceSelect/handleMapConfirm), not the async enrichment response; ` +
        `a manual pick made while enrichment is in flight must not be erased when the response lands`,
    );
  }

  assert.match(
    body,
    /const requestSeq = \+\+enrichmentRequestSeqRef\.current/,
    "enrichLocation must capture a request sequence token when it starts",
  );
  assert.match(
    body,
    /isStaleEnrichmentResponse\(requestSeq, enrichmentRequestSeqRef\.current\)/,
    "enrichLocation must reject its own response once a newer request has started (stale-response guard)",
  );

  // The staleness check must run before any state is mutated from the response.
  const guardIndex = body.indexOf("isStaleEnrichmentResponse(");
  const firstAutoSetterIndex = body.indexOf("setCityId(result.cityId)");
  assert.ok(guardIndex !== -1 && firstAutoSetterIndex !== -1);
  assert.ok(
    guardIndex < firstAutoSetterIndex,
    "the staleness guard must run before any auto-derived state is applied from the response",
  );
}

console.log("PlaceLocationPicker race-contract wiring: OK");

import * as assert from "node:assert/strict";

import {
  buildLocationTransitionPatch,
  computeEffectiveDistrictId,
  computeEffectiveMetroDistanceM,
  computeEffectiveMetroId,
  computeManualMetroDistanceM,
  isSameGeoPoint,
  isStaleEnrichmentResponse,
  MANUAL_GEO_OVERRIDE_RESET_PATCH,
  shouldClearManualGeoOverrides,
  type GeoPoint,
} from "./placeLocationGeoOverrides";

const MINSK: GeoPoint = { lat: 53.9006, lng: 27.559 };
// ~0.4m north of MINSK (well under the 1m tolerance).
const MINSK_SUB_METER_DRIFT: GeoPoint = { lat: 53.900604, lng: 27.559 };
// ~2m north of MINSK (past the 1m tolerance).
const MINSK_2M_MOVE: GeoPoint = { lat: 53.90062, lng: 27.559 };
// A genuinely different point across town.
const ELSEWHERE: GeoPoint = { lat: 53.8935, lng: 27.5666 };

// ── новая точка → manual overrides очищены ──────────────────────────────────────
assert.equal(
  shouldClearManualGeoOverrides(null, MINSK),
  true,
  "no prior point on record (first-ever pick) clears manual overrides",
);

// ── та же точка → сохранены ──────────────────────────────────────────────────────
assert.equal(
  shouldClearManualGeoOverrides(MINSK, { ...MINSK }),
  false,
  "re-enrichment of the exact same point keeps manual overrides",
);

// ── drift <1м → сохранены ─────────────────────────────────────────────────────────
assert.equal(
  isSameGeoPoint(MINSK, MINSK_SUB_METER_DRIFT),
  true,
  "sub-meter drift is treated as the same point",
);
assert.equal(
  shouldClearManualGeoOverrides(MINSK, MINSK_SUB_METER_DRIFT),
  false,
  "sub-meter drift keeps manual overrides",
);

// ── movement >1м → очищены ───────────────────────────────────────────────────────
assert.equal(
  isSameGeoPoint(MINSK, MINSK_2M_MOVE),
  false,
  "a ~2m move is not the same point",
);
assert.equal(
  shouldClearManualGeoOverrides(MINSK, MINSK_2M_MOVE),
  true,
  "a real (>1m) movement clears manual overrides",
);
assert.equal(
  shouldClearManualGeoOverrides(MINSK, ELSEWHERE),
  true,
  "a genuinely different point clears manual overrides",
);

// A custom tolerance is respected too (not hardcoded to 1m internally).
assert.equal(
  shouldClearManualGeoOverrides(MINSK, MINSK_2M_MOVE, 5),
  false,
  "a wider explicit tolerance can accept a move that the default would reject",
);

// ── effective auto после invalidation ────────────────────────────────────────────
assert.equal(
  computeEffectiveDistrictId({ districtManualId: "manual-1", districtAutoId: "auto-1" }),
  "manual-1",
  "manual district wins over auto while both are set",
);
assert.equal(
  computeEffectiveDistrictId({ districtManualId: null, districtAutoId: "auto-1" }),
  "auto-1",
  "auto district is effective once manual is cleared",
);
assert.equal(
  computeEffectiveDistrictId({ districtManualId: null, districtAutoId: null }),
  null,
  "effective district is null after both manual and a null-result auto enrichment",
);
assert.equal(
  computeEffectiveMetroId({ metroManualId: null, metroAutoId: null }),
  null,
  "effective metro is null after both manual and a null-result auto enrichment",
);

// ── manual metro distance ────────────────────────────────────────────────────────
const manualDistance = computeManualMetroDistanceM(MINSK, ELSEWHERE);
assert.ok(
  manualDistance > 800 && manualDistance < 1200,
  `expected the manually-picked station distance to be ~1km, got ${manualDistance}m`,
);
assert.equal(
  computeEffectiveMetroDistanceM({
    metroManualId: "station-1",
    metroManualDistanceM: manualDistance,
    metroAutoDistanceM: 250,
  }),
  manualDistance,
  "effective distance follows the manual pick, not the stale auto distance",
);
assert.equal(
  computeEffectiveMetroDistanceM({
    metroManualId: null,
    metroManualDistanceM: manualDistance,
    metroAutoDistanceM: 250,
  }),
  250,
  "effective distance falls back to auto once there is no manual metro pick",
);

// ── reset metro очищает ID + distance ────────────────────────────────────────────
assert.deepEqual(
  MANUAL_GEO_OVERRIDE_RESET_PATCH,
  { districtManualId: null, metroManualId: null, metroManualDistanceM: null },
  "resetting manual overrides clears both the metro id and its distance, plus district",
);

// ── onUpdate patch содержит explicit nulls ───────────────────────────────────────
// Guards against a future refactor that drops the key instead of nulling it,
// which would leave a stale value on the parent/server side after a merge.
for (const key of ["districtManualId", "metroManualId", "metroManualDistanceM"] as const) {
  assert.ok(
    Object.prototype.hasOwnProperty.call(MANUAL_GEO_OVERRIDE_RESET_PATCH, key),
    `reset patch must explicitly include ${key}, not omit it`,
  );
  assert.equal(
    MANUAL_GEO_OVERRIDE_RESET_PATCH[key],
    null,
    `reset patch's ${key} must be an explicit null`,
  );
}

// ── Race contract: location transition vs. async enrichment ─────────────────────
//
// Regression coverage for the P1 review finding: manual overrides must be
// invalidated SYNCHRONOUSLY when a real location move is accepted (before
// enrichment even starts), never later from the async enrichment response —
// otherwise a manual pick made for the new point while enrichment is still
// in flight gets silently erased when that response lands.

// 1. A → B immediately builds a reset patch, independent of any enrichment result.
{
  const patch = buildLocationTransitionPatch(
    { lat: MINSK_2M_MOVE.lat, lng: MINSK_2M_MOVE.lng },
    shouldClearManualGeoOverrides(MINSK, MINSK_2M_MOVE),
  );
  assert.deepEqual(
    patch,
    {
      lat: MINSK_2M_MOVE.lat,
      lng: MINSK_2M_MOVE.lng,
      districtManualId: null,
      metroManualId: null,
      metroManualDistanceM: null,
    },
    "a real move's location patch carries the manual-override reset in the SAME object as the location fields",
  );
}

// 2/6. Meaningful movement still produces the exact explicit-null shape,
// regardless of whatever an (unrelated, not-yet-arrived) enrichment response
// might contain — the reset is a pure function of the two points, not of
// any network result.
{
  const patch = buildLocationTransitionPatch({ lat: ELSEWHERE.lat, lng: ELSEWHERE.lng }, true);
  assert.equal(patch.districtManualId, null);
  assert.equal(patch.metroManualId, null);
  assert.equal(patch.metroManualDistanceM, null);
  assert.ok(
    Object.prototype.hasOwnProperty.call(patch, "metroManualDistanceM"),
    "the reset key is present (explicit null), not merely absent",
  );
}

// 5. A same-point transition produces NO manual-override reset — the patch
// is exactly the location fields, nothing more. This is what makes it safe
// for a manual pick already in flight at the same point to survive.
{
  const patch = buildLocationTransitionPatch(
    { lat: MINSK.lat, lng: MINSK.lng },
    shouldClearManualGeoOverrides(MINSK, MINSK_SUB_METER_DRIFT),
  );
  assert.deepEqual(
    patch,
    { lat: MINSK.lat, lng: MINSK.lng },
    "a same-point (sub-tolerance) transition must not include any manual-override reset",
  );
  assert.ok(
    !Object.prototype.hasOwnProperty.call(patch, "districtManualId"),
    "same-point patch omits districtManualId entirely — it must not silently null it either",
  );
}

// 3/4. Overlapping requests B then C: only the response matching the LATEST
// started request may apply. A late-arriving response for the superseded
// request B must be treated as stale, even though it resolves AFTER C
// started (out-of-order network resolution).
{
  let latestSeq = 0;

  // Request B starts.
  latestSeq += 1;
  const requestSeqB = latestSeq;

  // Request C starts before B's response has arrived.
  latestSeq += 1;
  const requestSeqC = latestSeq;

  // B's response finally arrives — it must be rejected as stale.
  assert.equal(
    isStaleEnrichmentResponse(requestSeqB, latestSeq),
    true,
    "a late response for a superseded request (B, after C started) is stale and must be discarded",
  );

  // C's response arrives — it is the latest request and must be accepted.
  assert.equal(
    isStaleEnrichmentResponse(requestSeqC, latestSeq),
    false,
    "the response matching the latest-started request is not stale and may apply its auto patch",
  );
}

// A request whose response arrives before any newer request has started is
// never mistaken for stale.
{
  let latestSeq = 0;
  latestSeq += 1;
  const onlyRequestSeq = latestSeq;
  assert.equal(
    isStaleEnrichmentResponse(onlyRequestSeq, latestSeq),
    false,
    "a single in-flight request's own response is never stale",
  );
}

console.log("placeLocationGeoOverrides tests: OK");

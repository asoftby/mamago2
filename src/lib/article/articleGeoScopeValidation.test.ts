import assert from "node:assert/strict";

import { validateArticleGeoScope } from "./articleGeoScopeValidation";

// ── CITY ──────────────────────────────────────────────────────────────────

assert.deepEqual(
  validateArticleGeoScope({ geoScope: "CITY", cityId: "city-minsk", regionId: null, strict: true }),
  { ok: true },
  "CITY + cityId → PASS",
);

assert.equal(
  validateArticleGeoScope({ geoScope: "CITY", cityId: null, regionId: null, strict: true }).ok,
  false,
  "CITY without cityId → FAIL",
);

assert.equal(
  validateArticleGeoScope({ geoScope: "CITY", cityId: "city-minsk", regionId: "region-minsk", strict: true }).ok,
  false,
  "CITY + regionId → FAIL",
);

// ── REGION ────────────────────────────────────────────────────────────────

assert.deepEqual(
  validateArticleGeoScope({ geoScope: "REGION", cityId: null, regionId: "region-vitebsk", strict: true }),
  { ok: true },
  "REGION + regionId → PASS",
);

assert.equal(
  validateArticleGeoScope({ geoScope: "REGION", cityId: null, regionId: null, strict: true }).ok,
  false,
  "REGION without regionId → FAIL",
);

assert.equal(
  validateArticleGeoScope({ geoScope: "REGION", cityId: "city-minsk", regionId: "region-vitebsk", strict: true }).ok,
  false,
  "REGION + cityId → FAIL",
);

// ── COUNTRY ───────────────────────────────────────────────────────────────

assert.deepEqual(
  validateArticleGeoScope({ geoScope: "COUNTRY", cityId: null, regionId: null, strict: true }),
  { ok: true },
  "COUNTRY with neither → PASS",
);

assert.equal(
  validateArticleGeoScope({ geoScope: "COUNTRY", cityId: "city-minsk", regionId: null, strict: true }).ok,
  false,
  "COUNTRY + cityId → FAIL",
);

assert.equal(
  validateArticleGeoScope({ geoScope: "COUNTRY", cityId: null, regionId: "region-vitebsk", strict: true }).ok,
  false,
  "COUNTRY + regionId → FAIL",
);

// ── Draft (no scope chosen yet) ───────────────────────────────────────────

assert.deepEqual(
  validateArticleGeoScope({ geoScope: null, cityId: null, regionId: null, strict: false }),
  { ok: true },
  "non-strict draft with no scope → PASS",
);

assert.equal(
  validateArticleGeoScope({ geoScope: null, cityId: null, regionId: null, strict: true }).ok,
  false,
  "strict (publish) with no scope → FAIL",
);

console.log("articleGeoScopeValidation tests: OK");

/**
 * Regression guard for authenticated responsive media previews.
 *
 * Picker grids must request small variants through /api/media/:id, but the
 * route must authorize the canonical MediaAsset first and only then resolve
 * a sibling responsive file. Missing variants fall back to the master.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/api/media/[filename]/route.ts", "utf8");

assert.match(
  source,
  /MEDIA_PREVIEW_VARIANTS = new Set\(\["sm", "md", "lg", "xl"\]\)/,
  "media route must whitelist responsive preview variants",
);
assert.match(
  source,
  /canLoadMediaAnonymously\(media\)[\s\S]*canServeMediaResponse\(media, user\)/,
  "canonical MediaAsset access must be checked before serving a preview",
);
assert.match(
  source,
  /resolveResponsiveVariantPath\(filepath, variant\)/,
  "authorized master path must be used as the source for the requested variant",
);
assert.match(
  source,
  /existsSync\(candidate\) \? candidate : masterPath/,
  "missing responsive files must safely fall back to the master",
);

assert.match(
  source,
  /\^https\?:\\\/\\\//i,
  "legacy external media must keep an authenticated redirect fallback",
);

console.log("media responsive preview route contract: OK");

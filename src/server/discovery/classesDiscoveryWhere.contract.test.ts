import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("class listing exposes a single eligibility WHERE for counting and pages", () => {
  const source = readFileSync("src/server/discovery/classesDiscoveryFeed.ts", "utf8");
  assert.match(source, /export function buildClassesDiscoveryWhere\(/);
  assert.match(source, /const where = buildClassesDiscoveryWhere\(/);
  const eligible = source.slice(source.indexOf("export function buildClassesDiscoveryWhere("), source.indexOf("async function runQuery("));
  assert.match(eligible, /getCanonicalOfferPrice|buildCanonicalOfferPriceWhere/);
  assert.match(eligible, /classChipSlugs/);
  assert.doesNotMatch(eligible, /userId|personaId|familyId/);
});

/**
 * Tests for the WP-legacy catch-all path classifier.
 * Run: pnpm test:wp-catch-all (tsx, assert-based — project convention).
 *
 * Главная проверка — KNOWN_ROOT_SEGMENTS не разъехался с реальным деревом
 * src/app: middleware работает на Edge (без fs), поэтому список статический,
 * и дрифт ловится только здесь.
 */

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";

import {
  isWpLegacyCatchAllPath,
  KNOWN_ROOT_SEGMENTS,
  WP_LEGACY_CATCH_ALL_DESTINATION,
} from "./wpLegacyCatchAll";

// ─── 1. KNOWN_ROOT_SEGMENTS must mirror src/app ──────────────────────────────

const appDir = join(process.cwd(), "src", "app");

function listRouteDirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

const derived = new Set<string>();
for (const name of listRouteDirs(appDir)) {
  if (name.startsWith("[") || name.startsWith("_") || name.includes(".")) continue;
  if (name.startsWith("(")) {
    for (const child of listRouteDirs(join(appDir, name))) {
      if (child.startsWith("[") || child.startsWith("_") || child.includes(".")) continue;
      derived.add(child);
    }
    continue;
  }
  derived.add(name);
}

const listed = new Set<string>(KNOWN_ROOT_SEGMENTS);
const missingFromList = [...derived].filter((s) => !listed.has(s)).sort();
const staleInList = [...listed].filter((s) => !derived.has(s)).sort();

assert.deepEqual(
  missingFromList,
  [],
  `KNOWN_ROOT_SEGMENTS misses real top-level routes (would 301 them to the hub): ${missingFromList.join(", ")}`,
);
assert.deepEqual(
  staleInList,
  [],
  `KNOWN_ROOT_SEGMENTS lists segments with no route behind them: ${staleInList.join(", ")}`,
);

// ─── 2. Classification: WP long tail redirects ───────────────────────────────

assert.equal(isWpLegacyCatchAllPath("/some-unknown-wp-article"), true);
assert.equal(isWpLegacyCatchAllPath("/breakingnews/unknown-post"), true);
assert.equal(isWpLegacyCatchAllPath("/detskie-mesta/kafe/kafe-s-animatorami"), true);
assert.equal(isWpLegacyCatchAllPath("/age/18"), true);
assert.equal(isWpLegacyCatchAllPath("/journal/some-post"), true);

// ─── 3. Classification: real routes, cities, reserved, assets pass through ───

assert.equal(isWpLegacyCatchAllPath("/"), false);
assert.equal(isWpLegacyCatchAllPath("/minsk"), false);
assert.equal(isWpLegacyCatchAllPath("/minsk/blog/some-post"), false);
assert.equal(isWpLegacyCatchAllPath("/blog"), false);
assert.equal(isWpLegacyCatchAllPath("/routes/marshrut-malinovka"), false);
assert.equal(isWpLegacyCatchAllPath("/places/dino-park"), false);
assert.equal(isWpLegacyCatchAllPath("/api/health"), false);
assert.equal(isWpLegacyCatchAllPath("/admin/seo"), false);
assert.equal(isWpLegacyCatchAllPath("/me/settings"), false);
assert.equal(isWpLegacyCatchAllPath("/sitemap_index.xml"), false);
assert.equal(isWpLegacyCatchAllPath("/wp-content/uploads/2024/x.jpg"), false);
// upper-case first segment normalises like resolveRouteCitySlug does
assert.equal(isWpLegacyCatchAllPath("/Minsk"), false);

// ─── 4. Destination is the flagship hub ──────────────────────────────────────

assert.equal(WP_LEGACY_CATCH_ALL_DESTINATION, "/minsk");

console.log("wpLegacyCatchAll.test.ts: all assertions passed");

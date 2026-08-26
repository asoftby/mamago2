/**
 * Unit tests for city-scoped public URL builder and no-trailing-slash policy.
 * Run with: npx tsx src/lib/routing/cityPaths.test.ts
 */
import assert from "node:assert/strict";

import {
  buildArticlePublicPath,
  buildCityPublicPath,
  buildNationalArticlePath,
  stripTrailingSlash,
} from "./cityPaths";

// ── stripTrailingSlash ───────────────────────────────────────────────────────

assert.equal(stripTrailingSlash("/"), "/",            "root stays /");
assert.equal(stripTrailingSlash("/minsk"), "/minsk",  "no-op when already clean");
assert.equal(stripTrailingSlash("/minsk/"), "/minsk", "removes trailing slash");
assert.equal(
  stripTrailingSlash("/minsk/events/"),
  "/minsk/events",
  "removes slash from nested path",
);
assert.equal(stripTrailingSlash(""), "/", "empty string → root");

// ── city-scoped article path — NO trailing slash ─────────────────────────────

assert.equal(
  buildCityPublicPath({ citySlug: "minsk", type: "article", slug: "semeynyy-weekend" }),
  "/minsk/blog/semeynyy-weekend",
  "city article path",
);

assert.equal(
  buildCityPublicPath({ citySlug: "minsk", type: "journal" }),
  "/minsk/blog",
  "city blog list path",
);

assert.equal(
  buildCityPublicPath({ citySlug: "MINSK", type: "article", slug: "test" }),
  "/minsk/blog/test",
  "citySlug normalised to lowercase",
);

// ── national article path — NO trailing slash ────────────────────────────────

assert.equal(
  buildNationalArticlePath("natsionalnyy-obzor"),
  "/blog/natsionalnyy-obzor",
  "national article path",
);

// ── buildArticlePublicPath by geo scope ──────────────────────────────────────

assert.equal(
  buildArticlePublicPath({ slug: "semeynyy-weekend", geoScope: "CITY", citySlug: "minsk" }),
  "/minsk/blog/semeynyy-weekend",
  "CITY → /{city}/blog/{slug}",
);

assert.equal(
  buildArticlePublicPath({ slug: "braslavskiy-region", geoScope: "REGION", citySlug: null }),
  "/blog/braslavskiy-region",
  "REGION → /blog/{slug} (shares national namespace)",
);

assert.equal(
  buildArticlePublicPath({ slug: "natsionalnyy-obzor", geoScope: "COUNTRY", citySlug: null }),
  "/blog/natsionalnyy-obzor",
  "COUNTRY → /blog/{slug}",
);

// ── URL contract: NEVER /blog/{city}/{slug} ──────────────────────────────────

const cityPath = buildCityPublicPath({ citySlug: "minsk", type: "article", slug: "my-article" });
assert.ok(!cityPath.startsWith("/blog/"), "city article must NOT start with /blog/");
assert.equal(cityPath, "/minsk/blog/my-article", "city-first article URL contract");

// ── hub / events / places — all NO trailing slash ───────────────────────────

assert.equal(buildCityPublicPath({ citySlug: "minsk", type: "hub" }),    "/minsk");
assert.equal(buildCityPublicPath({ citySlug: "minsk", type: "events" }), "/minsk/events");
assert.equal(
  buildCityPublicPath({ citySlug: "minsk", type: "place", slug: "botanicheskiy-sad" }),
  "/minsk/places/botanicheskiy-sad",
);

// ── invariant: no path produced by the builder ends with slash ───────────────

const pathTypes = ["hub", "events", "places", "routes", "journal"] as const;
for (const type of pathTypes) {
  const p = buildCityPublicPath({ citySlug: "minsk", type });
  assert.ok(
    p === "/" || !p.endsWith("/"),
    `buildCityPublicPath type="${type}" must not end with slash, got: ${p}`,
  );
}

console.log("✅ cityPaths.test.ts — all assertions passed");

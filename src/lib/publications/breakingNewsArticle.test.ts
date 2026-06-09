/**
 * Unit tests for breaking-news geo model.
 *
 * Run with: npx tsx src/lib/publications/breakingNewsArticle.test.ts
 */
import assert from "node:assert/strict";

import {
  breakingNewsStateToArticleSaveInput,
  BREAKING_NEWS_SUBTITLE,
  type BreakingNewsFormState,
} from "./breakingNewsArticle";
import { buildArticlePublicPath } from "@/lib/routing/cityPaths";

// ── Helpers ──────────────────────────────────────────────────────────────────

function baseState(): BreakingNewsFormState {
  return {
    title: "Test News",
    slug: "test-news",
    coverImageId: "",
    galleryIds: [],
    bodyHtml: "<p>body</p>",
    pricingHtml: "",
    linkedEntityType: "PLACE",
    linkedEntityId: "",
    status: "DRAFT",
    scheduledAtLocal: "",
    publishedAtLocal: "",
    seoTitle: "",
    seoDescription: "",
    seoCanonicalUrl: "",
    noindex: false,
    authorUserId: null,
    geoScope: null,
    cityId: null,
  };
}

const opts = { publishedAtIso: null, scheduledAtIso: null };

// ── subtitle marker is always preserved ──────────────────────────────────────

{
  const input = breakingNewsStateToArticleSaveInput(
    { ...baseState(), geoScope: "COUNTRY" },
    opts,
  );
  assert.equal(input.subtitle, BREAKING_NEWS_SUBTITLE, "subtitle marker preserved");
}

// ── COUNTRY breaking news ────────────────────────────────────────────────────

{
  const input = breakingNewsStateToArticleSaveInput(
    { ...baseState(), geoScope: "COUNTRY", cityId: null },
    opts,
  );
  assert.equal(input.geoScope, "COUNTRY", "COUNTRY geoScope passes through");
  assert.equal(input.cityId, null, "COUNTRY forces cityId = null");
}

// COUNTRY with stale cityId in state → still nulled
{
  const input = breakingNewsStateToArticleSaveInput(
    { ...baseState(), geoScope: "COUNTRY", cityId: "some-city-id" },
    opts,
  );
  assert.equal(input.cityId, null, "COUNTRY clears cityId even if state had one");
}

// ── CITY breaking news ───────────────────────────────────────────────────────

{
  const input = breakingNewsStateToArticleSaveInput(
    { ...baseState(), geoScope: "CITY", cityId: "minsk-id" },
    opts,
  );
  assert.equal(input.geoScope, "CITY", "CITY geoScope passes through");
  assert.equal(input.cityId, "minsk-id", "CITY preserves cityId");
}

// CITY without cityId → null (form didn't choose a city yet)
{
  const input = breakingNewsStateToArticleSaveInput(
    { ...baseState(), geoScope: "CITY", cityId: null },
    opts,
  );
  assert.equal(input.geoScope, "CITY", "CITY scope preserved even without cityId");
  assert.equal(input.cityId, null, "CITY without cityId = null (validation catches at publish)");
}

// ── Draft state (geoScope = null) ────────────────────────────────────────────

{
  const input = breakingNewsStateToArticleSaveInput(
    { ...baseState(), geoScope: null, cityId: null },
    opts,
  );
  assert.equal(input.geoScope, null, "null geoScope passes through for draft");
  assert.equal(input.cityId, null, "null cityId for draft");
}

// ── URL preview: buildArticlePublicPath reflects geoScope ────────────────────

assert.equal(
  buildArticlePublicPath({ slug: "test-news", geoScope: "COUNTRY" }),
  "/blog/test-news",
  "COUNTRY breaking news → /blog/{slug}",
);

assert.equal(
  buildArticlePublicPath({ slug: "test-news", geoScope: "CITY", citySlug: "minsk" }),
  "/minsk/blog/test-news",
  "CITY breaking news → /{city}/blog/{slug}",
);

// No trailing slash on either URL
assert.ok(
  !buildArticlePublicPath({ slug: "test", geoScope: "COUNTRY" }).endsWith("/"),
  "no trailing slash — COUNTRY",
);
assert.ok(
  !buildArticlePublicPath({ slug: "test", geoScope: "CITY", citySlug: "minsk" }).endsWith("/"),
  "no trailing slash — CITY",
);

// ── listCityHomeArticles feed contract (documented expectations) ─────────────
// The actual DB query is tested via integration tests; here we document the invariant:
//
//   city page shows:
//     OR [
//       { geoScope: "CITY", cityId: city.id }   ← city articles + city breaking news
//       { subtitle: BREAKING_NEWS_SUBTITLE, geoScope: "COUNTRY" }  ← national breaking news
//     ]
//
// This means:
//   • CITY breaking news for minsk does NOT appear in gomel (different cityId)
//   • COUNTRY breaking news appears in all cities (subtitle filter)
// This invariant is already implemented in listCityHomeArticles.ts — no code change needed.

console.log("✅ breakingNewsArticle.test.ts — all assertions passed");

/**
 * Unit tests for breaking-news geo model.
 *
 * Run with: npx tsx src/lib/publications/breakingNewsArticle.test.ts
 */
import assert from "node:assert/strict";

import {
  breakingNewsStateToArticleSaveInput,
  buildBreakingNewsContent,
  BREAKING_NEWS_SUBTITLE,
  parseBreakingNewsFromSnapshot,
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

// ── Manual pricing is independent from linked Place ───────────────────────────

{
  const manualCost = "25,00 Br";
  const content = buildBreakingNewsContent({
    ...baseState(),
    pricingHtml: manualCost,
    linkedEntityType: "PLACE",
    linkedEntityId: "place-123",
  });
  const texts = content.blocks.filter(
    (b): b is Extract<(typeof content.blocks)[number], { type: "text" }> => b.type === "text",
  );
  assert.equal(texts[1]?.text, manualCost, "manual cost preserved when place is linked");
  assert.ok(
    content.blocks.some(
      (b) => b.type === "activityCard" && b.entityType === "PLACE" && b.entityId === "place-123",
    ),
    "linked place block is still saved",
  );
}

{
  const parsed = parseBreakingNewsFromSnapshot({
    id: "article-1",
    title: "Test News",
    slug: "test-news",
    subtitle: BREAKING_NEWS_SUBTITLE,
    excerpt: null,
    content: buildBreakingNewsContent({
      ...baseState(),
      pricingHtml: "Бесплатно",
      linkedEntityType: "PLACE",
      linkedEntityId: "place-456",
    }),
    heroImage: null,
    coverImageId: null,
    coverImageUrl: null,
    authorLabel: null,
    authorUserId: null,
    cityContext: null,
    geoScope: "COUNTRY",
    cityId: null,
    status: "DRAFT",
    publishedAt: null,
    scheduledAt: null,
    seoTitle: null,
    seoDescription: null,
    seoCanonicalUrl: null,
    seoOgTitle: null,
    seoOgDescription: null,
    seoOgImage: null,
    seoImageId: null,
    seoImageUrl: null,
    seoRobots: null,
    noindex: false,
    views: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.equal(parsed.pricingHtml, "Бесплатно", "manual cost round-trips from snapshot");
  assert.equal(parsed.linkedEntityId, "place-456", "linked place round-trips from snapshot");
}

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

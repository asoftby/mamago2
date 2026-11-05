import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("city and country Breaking News article pages use continuous reading", () => {
  const city = source("../../app/(public)/[city]/blog/[slug]/page.tsx");
  const country = source("../../app/(public)/blog/[slug]/page.tsx");
  for (const page of [city, country]) {
    assert.match(page, /<BreakingNewsView/);
    assert.match(page, /<BreakingNewsLazyNext initialArticleId=\{mvp\.id\}/);
    assert.ok(!page.includes("loadRelatedBreakingNews"), "no related-card feed between articles");
  }
  assert.match(city, /citySlug=\{city\.slug\}/);
});

test("archive is shown only after the last article, not between articles", () => {
  const reader = source("./BreakingNewsLazyNext.tsx");
  const view = source("../article/mvp/BreakingNewsView.tsx");
  assert.match(reader, /const complete = !hasMore && !next && !loadingList && !loadingArticle && !error/);
  assert.match(reader, /\{complete \? \([\s\S]*?Архив Breaking News/);
  assert.ok(!view.includes("RelatedSection"), "related navigation must not interrupt continuous reading");
  assert.ok(!view.includes('minHeight: "100vh"'), "short news must not leave a full-screen blank gap");
  assert.ok(!view.includes('position: "fixed", inset: 0, pointerEvents: "none"'), "grain overlays must not stack across news");
  assert.ok(!reader.includes("Далее в Breaking News"), "there is no intermediate next-news card");
});

test("Breaking News ticker appears only on the opening article", () => {
  const reader = source("./BreakingNewsLazyNext.tsx");
  const view = source("../article/mvp/BreakingNewsView.tsx");
  const city = source("../../app/(public)/[city]/blog/[slug]/page.tsx");
  const country = source("../../app/(public)/blog/[slug]/page.tsx");
  assert.match(view, /showBreakingTicker = true/);
  assert.match(view, /showBreakingTicker \? <Marquee items=\{marqueeItems\} \/> : null/);
  assert.match(reader, /<BreakingNewsView \{\.\.\.article\} showBreakingTicker=\{false\} \/>/);
  for (const page of [city, country]) {
    assert.match(page, /<BreakingNewsView/);
    assert.ok(!page.includes("showBreakingTicker={false}"), "opening article shows the ticker");
  }
});

test("continuation preserves canonical URLs for city and national news", () => {
  const nextEndpoint = source("../../app/api/journal/breaking-news/next/route.ts");
  const articleEndpoint = source("../../app/api/journal/breaking-news/article/route.ts");
  const reader = source("./BreakingNewsLazyNext.tsx");
  assert.ok(!nextEndpoint.includes("scopeWhere"), "the news index mixes geographic scopes");
  assert.match(articleEndpoint, /buildArticlePublicPath/);
  assert.match(articleEndpoint, /geoScope: row\.geoScope/);
  assert.match(articleEndpoint, /citySlug: row\.geoScope === "CITY"/);
  assert.match(reader, /articleHref: article\.href/);
});

test("scroll tracking and continuation work with regular pages and dialogs", () => {
  const reader = source("./BreakingNewsLazyNext.tsx");
  const overlay = source("./JournalNewsOverlay.tsx");
  assert.match(reader, /const root = document\.querySelector<HTMLElement>\("\.journal-news-panel"\)/);
  assert.match(reader, /const scrollTarget = root \?\? window/);
  assert.match(reader, /window\.history\.replaceState/);
  assert.ok(!overlay.includes("<BreakingNewsLazyNext"), "a dialog must not duplicate the article's reader");
});

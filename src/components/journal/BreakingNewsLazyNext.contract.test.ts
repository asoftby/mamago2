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

test("scroll tracking and continuation work with regular pages and dialogs", () => {
  const reader = source("./BreakingNewsLazyNext.tsx");
  const overlay = source("./JournalNewsOverlay.tsx");
  assert.match(reader, /const root = document\.querySelector<HTMLElement>\("\.journal-news-panel"\)/);
  assert.match(reader, /const scrollTarget = root \?\? window/);
  assert.match(reader, /window\.history\.replaceState/);
  assert.ok(!overlay.includes("<BreakingNewsLazyNext"), "a dialog must not duplicate the article's reader");
});

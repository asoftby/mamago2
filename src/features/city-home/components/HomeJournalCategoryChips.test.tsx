import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeJournalCategoryChips } from "./HomeJournalCategoryChips";

test("home journal shows linked image-led pills from actual categories", () => {
  const html = renderToStaticMarkup(<HomeJournalCategoryChips citySlug="minsk" categories={[
    { id: "a", slug: "routes", name: "Маршруты", thumbnailUrl: "/routes.jpg", hasNewArticle: false },
    { id: "b", slug: "reviews", name: "Обзоры", thumbnailUrl: null, hasNewArticle: false },
  ]} />);
  assert.match(html, /Категории журнала/);
  assert.match(html, /\bh-11\b/);
  assert.match(html, /\bsize-9\b/);
  assert.match(html, /\/minsk\/blog\/category\/routes/);
  assert.match(html, /\/minsk\/blog\/category\/reviews/);
  assert.match(html, /\/routes.jpg/);
  assert.match(html, /Все/);
});

test("empty category source still shows the All entry", () => {
  const html = renderToStaticMarkup(<HomeJournalCategoryChips citySlug="minsk" categories={[]} />);
  assert.match(html, /Категории журнала/);
  assert.match(html, /\/minsk\/blog/);
  assert.match(html, /Все/);
});

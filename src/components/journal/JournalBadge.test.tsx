import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JournalBadge, journalTypeBadgeVariant } from "./JournalBadge";

test("article has no type badge; collection and news do", () => {
  assert.equal(journalTypeBadgeVariant("ARTICLE"), null);
  assert.equal(journalTypeBadgeVariant("COLLECTION"), "collection");
  assert.equal(journalTypeBadgeVariant("BREAKING_NEWS"), "news");
});

test("badge labels and detail («ПОДБОРКА · 10», «НОВОСТЬ · 2 ч», «★ ГЛАВНОЕ»)", () => {
  const text = (html: string) => html.replace(/<[^>]+>/g, "");
  assert.equal(text(renderToStaticMarkup(<JournalBadge variant="collection" detail="10" />)), "Подборка · 10");
  assert.equal(text(renderToStaticMarkup(<JournalBadge variant="news" detail="2 ч" />)), "Новость · 2 ч");
  assert.equal(text(renderToStaticMarkup(<JournalBadge variant="main" />)), "★ Главное");
  const news = renderToStaticMarkup(<JournalBadge variant="news" />);
  assert.match(news, /bg-foreground text-background/, "news: dark background, white text");
  const collection = renderToStaticMarkup(<JournalBadge variant="collection" />);
  assert.match(collection, /bg-brand-soft text-brand-ink/, "collection: light background, dark orange text");
  assert.match(news, /uppercase/);
});

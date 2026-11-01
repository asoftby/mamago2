import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import { JournalNewsCard } from "./JournalCards";
import { HorizontalCardRow } from "@/features/city-home/components/HorizontalCardRow";

const article = {
  id: "news-1", title: "Открылась новая площадка для всей семьи", href: "/minsk/blog/news-1",
  coverImageUrl: "/news-cover.jpg", publicationType: "BREAKING_NEWS",
  publishedAt: new Date(Date.now() - 120_000).toISOString(),
  excerpt: "Описание не должно появляться",
} as unknown as CityHomeJournalArticle;

test("news story keeps the article link, cover and relative time without extra metadata", () => {
  const html = renderToStaticMarkup(<JournalNewsCard article={article} />);
  assert.match(html, /href="\/minsk\/blog\/news-1"/);
  assert.match(html, /src="\/news-cover.jpg"/);
  assert.match(html, /2 мин назад/);
  assert.match(html, /<h3[^>]*line-clamp-2/);
  assert.doesNotMatch(html, /Новость|Описание не должно|avatar|bg-background/);
  assert.match(renderToStaticMarkup(<JournalNewsCard article={{ ...article, coverImageUrl: null, publishedAt: null }} />), /Открылась новая/);
});

test("shared header contains the title, all link and separate navigation in normal flow", () => {
  const html = renderToStaticMarkup(
    <HorizontalCardRow headerTitle={<h2>Breaking News</h2>} navLeading={<Link href="/blog?type=news">Все →</Link>}>
      <JournalNewsCard article={article} />
    </HorizontalCardRow>,
  );
  const header = html.slice(0, html.indexOf('scrollbar-width'));
  assert.match(header, /Breaking News/);
  assert.match(header, /href="\/blog\?type=news"/);
  assert.match(header, /Предыдущие публикации/);
  assert.match(header, /Следующие публикации/);
  assert.match(header, /hidden sm:block/);
  assert.doesNotMatch(header, /lg:absolute|lg:-top|absolute right-0 -top/);
});

// Mobile editorial hierarchy: section heading is 24px, article title 4px smaller.
test("mobile journal article heading stays 4px smaller than Fresh Materials", () => {
  const pageSource = readFileSync(new URL("./JournalPageView.tsx", import.meta.url), "utf8");
  const cardSource = readFileSync(new URL("./JournalCards.tsx", import.meta.url), "utf8");
  const section = pageSource.match(/<h2 id="journal-feed-title" className="[^"]*?text-\[(\d+)px\]/);
  const card = cardSource.match(/<h3 className="[^"]*mt-\[9px\][^"]*text-\[(\d+)px\][^"]*leading-\[([0-9.]+)\]/);
  assert.ok(section, "section heading typography must remain explicit");
  assert.ok(card, "mobile article card typography must remain explicit");
  assert.equal(Number(section[1]) - Number(card[1]), 4);
  assert.equal(Number(card[1]), 20);
  assert.equal(Number(card[2]), 1.2);
});

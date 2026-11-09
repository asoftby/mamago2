import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeMoreEventsCard } from "./HomeMoreEventsCard";

test("one poster-height catalog link without a false empty-state card", () => {
  const html = renderToStaticMarkup(<HomeMoreEventsCard href="/minsk/events" />);
  assert.match(html, /Ещё варианты/);
  assert.match(html, /Куда пойти/);
  assert.ok(html.includes('href="/minsk/events"'));
  assert.ok(html.includes("aspect-[2/3]"));
  assert.match(html, /bg-card/);
  assert.doesNotMatch(html, /По вашему запросу мы ничего не нашли|Попробуйте другие варианты/);
  assert.doesNotMatch(html, /border-dashed|bg-image|background-image/);
});

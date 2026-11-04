import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeMoreEventsCard } from "./HomeMoreEventsCard";

test("one poster-height end card, only links when catalog has available events", () => {
  const empty = renderToStaticMarkup(<HomeMoreEventsCard href="/minsk/events" hasEvents={false} />);
  assert.match(empty, /Нет событий/);
  assert.doesNotMatch(empty, /href=|Ещё варианты/);
  const more = renderToStaticMarkup(<HomeMoreEventsCard href="/minsk/events" hasEvents />);
  assert.match(more, /Ещё варианты/);
  assert.match(more, /Куда пойти/);
  assert.match(more, /href="\/minsk\/events"/);
  assert.doesNotMatch(more, /Нет событий/);
  assert.match(empty, /aspect-\[2\/3\]/);
  assert.match(more, /aspect-\[2\/3\]/);
});

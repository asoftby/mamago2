import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectionSchedulePrice } from "./CollectionSchedulePrice";

test("free and numeric prices reserve their own column and align against the time row", () => {
  const free = renderToStaticMarkup(<CollectionSchedulePrice label="Ближайший сеанс" date="чт, 5 ноя. 2026" detail="начало в 10:00" price="Бесплатно" />);
  const paid = renderToStaticMarkup(<CollectionSchedulePrice label="Ближайший сеанс" date="пт, 6 ноя. 2026" detail="начало в 11:00" price="от 15 BYN" />);
  for (const html of [free, paid]) {
    assert.match(html, /grid-cols-\[minmax\(0,1fr\)_max-content\]/);
    assert.match(html, /items-baseline gap-x-4 gap-y-1\.5/);
    assert.match(html, /col-start-1 row-start-3/);
    assert.match(html, /col-start-2 row-start-3 self-baseline/);
    assert.doesNotMatch(html, /translate-y/);
    assert.match(html, /Стоимость/);
  }
  assert.match(free, /Бесплатно/);
  assert.match(paid, /15,00/);
});

test("long place name wraps and keeps a gap from numeric price", () => {
  const html = renderToStaticMarkup(<CollectionSchedulePrice label="Предложение" date="Тестовая площадка mamaGo LOCAL" price="45 BYN" />);
  assert.match(html, /gap-x-4/);
  assert.match(html, /break-words/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /Тестовая площадка mamaGo LOCAL/);
  assert.match(html, /45,00/);
});

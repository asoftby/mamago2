import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleContactsBlock, ArticleOpeningHoursBlock, ArticlePriceBlock } from "./ArticleStructuredInfoBlocks";

{
  const html = renderToStaticMarkup(<ArticleContactsBlock data={{ address: "ул. Примерная, 1", phones: [{ value: "+375291112233" }], email: "hi@example.by", website: "https://example.by", socials: [{ kind: "telegram", url: "https://t.me/example" }] }} />);
  assert.match(html, /Контакты/);
  assert.match(html, /tel:\+375291112233/);
  assert.match(html, /mailto:hi@example.by/);
  assert.match(html, /target="_blank"/);
  assert.equal(renderToStaticMarkup(<ArticleContactsBlock data={{ phones: [], socials: [] }} />), "");
  assert.match(renderToStaticMarkup(<ArticleContactsBlock data={{ phones: [], socials: [], mapUrl: "https://maps.example/place" }} />), /Открыть на карте/);
  assert.match(renderToStaticMarkup(<ArticleContactsBlock data={{ phones: [], socials: [], mapUrl: "https://maps.example/place" }} />), /rel="noreferrer"/);
  assert.match(renderToStaticMarkup(<ArticleContactsBlock data={{ address: "Минск", phones: [], socials: [] }} />), /Минск/);
}

{
  const html = renderToStaticMarkup(<ArticlePriceBlock data={{ mode: "RANGE", currency: "BYN", min: 10, max: 20, items: [{ id: "a", label: "Детский", price: "10", unit: "BYN" }, { id: "b", label: "Взрослый", price: "20", unit: "BYN" }], note: "Билеты онлайн" }} />);
  assert.ok(html.indexOf("Детский") < html.indexOf("Взрослый"), "price item ordering is preserved");
  assert.match(renderToStaticMarkup(<ArticlePriceBlock data={{ mode: "FREE", currency: "BYN", min: 0, max: 0, items: [], note: "" }} />), /Бесплатно/);
  assert.match(renderToStaticMarkup(<ArticlePriceBlock data={{ mode: "EXACT", currency: "BYN", min: 15, max: 15, items: [], note: "" }} />), /15/);
  assert.match(renderToStaticMarkup(<ArticlePriceBlock data={{ mode: "FROM", currency: "BYN", min: 15, max: null, items: [], note: "" }} />), /от 15/);
  assert.match(renderToStaticMarkup(<ArticlePriceBlock data={{ mode: "RANGE", currency: "BYN", min: 10, max: 20, items: [], note: "" }} />), /10.*20/);
  assert.equal(renderToStaticMarkup(<ArticlePriceBlock data={{ mode: "NONE", currency: "BYN", min: null, max: null, items: [], note: "" }} />), "");
  assert.equal(renderToStaticMarkup(<ArticlePriceBlock data={{ mode: "UNKNOWN", currency: "BYN", min: null, max: null, items: [], note: "" }} />), "");
}

{
  const html = renderToStaticMarkup(<ArticleOpeningHoursBlock data={{ mode: "WEEKLY", timezone: "Europe/Minsk", rules: [{ dayOfWeek: "MON", isOpen: true, allDay: false, intervals: [{ startTime: "10:00", endTime: "14:00" }, { startTime: "15:00", endTime: "20:00" }] }, { dayOfWeek: "SUN", isOpen: false, allDay: false, intervals: [] }], exceptions: [{ date: "2028-02-29", isClosed: true, allDay: false, intervals: [] }] }} />);
  assert.match(html, /10:00–14:00, 15:00–20:00/);
  assert.match(html, /2028-02-29/);
  assert.equal(renderToStaticMarkup(<ArticleOpeningHoursBlock data={{ mode: "WEEKLY", timezone: "Europe\/Minsk", rules: [], exceptions: [] }} />), "");
}

console.log("ArticleStructuredInfoBlocks.test.tsx: OK");

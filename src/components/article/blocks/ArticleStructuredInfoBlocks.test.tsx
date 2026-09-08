import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleContactsBlock, ArticleInfoCard, ArticleOpeningHoursBlock, ArticlePriceBlock } from "./ArticleStructuredInfoBlocks";

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

  // "Позвонить" CTA must render with explicit white text (and icon), not the
  // primary-foreground alias, and must not go dark on hover/focus.
  const callHtml = renderToStaticMarkup(<ArticleContactsBlock data={{ phones: [{ value: "+375291112233" }], socials: [] }} />);
  const callButtonMatch = callHtml.match(/<a href="tel:\+375291112233"[^>]*>[\s\S]*?<\/a>/);
  assert.ok(callButtonMatch, "call CTA must render");
  assert.match(callButtonMatch![0], /!text-white/);
  assert.match(callButtonMatch![0], /hover:!text-white/);
  assert.doesNotMatch(callButtonMatch![0], /text-primary-foreground/);
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

  // BYN currency must render as the project's Belarusian ruble icon, never
  // the literal "BYN" text — for both price items and the summary line.
  const itemHtml = renderToStaticMarkup(<ArticlePriceBlock data={{ mode: "NONE", currency: "BYN", min: null, max: null, items: [{ id: "a", label: "Билет", price: "15", unit: "BYN" }], note: "" }} />);
  assert.doesNotMatch(itemHtml, /\bBYN\b/);
  assert.match(itemHtml, /aria-label="бел\. руб\."/);

  const summaryHtml = renderToStaticMarkup(<ArticlePriceBlock data={{ mode: "EXACT", currency: "BYN", min: 15, max: 15, items: [], note: "" }} />);
  assert.doesNotMatch(summaryHtml, /\bBYN\b/);
  assert.match(summaryHtml, /aria-label="бел\. руб\."/);
}

{
  const html = renderToStaticMarkup(<ArticleOpeningHoursBlock data={{ mode: "WEEKLY", timezone: "Europe/Minsk", rules: [{ dayOfWeek: "MON", isOpen: true, allDay: false, intervals: [{ startTime: "10:00", endTime: "14:00" }, { startTime: "15:00", endTime: "20:00" }] }, { dayOfWeek: "SUN", isOpen: false, allDay: false, intervals: [] }], exceptions: [{ date: "2028-02-29", isClosed: true, allDay: false, intervals: [] }] }} />);
  assert.match(html, /10:00–14:00, 15:00–20:00/);
  assert.match(html, /2028-02-29/);
  assert.equal(renderToStaticMarkup(<ArticleOpeningHoursBlock data={{ mode: "WEEKLY", timezone: "Europe\/Minsk", rules: [], exceptions: [] }} />), "");

  // Weekly schedule must render collapsed by default: the status banner is
  // always visible, the toggle starts closed (aria-expanded="false"), and
  // the day-list panel carries the `hidden` attribute so it is out of the
  // accessibility tree and not visually shown until expanded.
  assert.match(html, /aria-expanded="false"/);
  const panelMatch = html.match(/<div id="([^"]+)" hidden="">([\s\S]*)<\/div><\/div><\/section>$/);
  assert.ok(panelMatch, "collapsed schedule panel must carry the hidden attribute");
  assert.match(panelMatch![2], /Понедельник/, "weekly rows still render inside the (hidden) panel");
  assert.match(html, /aria-controls="([^"]+)"/);
  const controlsId = html.match(/aria-controls="([^"]+)"/)![1];
  assert.equal(controlsId, panelMatch![1], "toggle button must reference the panel it controls");
  assert.match(html, /Показать расписание на неделю/);
}

{
  // Merged card: all three sections render inside one card.
  const html = renderToStaticMarkup(
    <ArticleInfoCard
      contacts={{ address: "ул. Примерная, 1", phones: [{ value: "+375291112233" }], socials: [], coordinates: { latitude: 53.9, longitude: 27.5 } }}
      price={{ mode: "FROM", currency: "BYN", min: 10, max: null, items: [], note: "" }}
      openingHours={{ mode: "WEEKLY", timezone: "Europe/Minsk", rules: [{ dayOfWeek: "MON", isOpen: true, allDay: true, intervals: [] }], exceptions: [] }}
    />,
  );
  assert.match(html, /Режим работы/);
  assert.match(html, /Стоимость/);
  assert.match(html, /ул\. Примерная, 1/);
  assert.match(html, /tel:\+375291112233/);
  assert.match(html, /Понедельник/);
  assert.match(html, /Открыто сейчас|Закрыто сейчас/);
}

{
  // Missing openingHours: the price column takes the full card, no hours column.
  const html = renderToStaticMarkup(
    <ArticleInfoCard
      contacts={{ address: "Минск", phones: [], socials: [] }}
      price={{ mode: "EXACT", currency: "BYN", min: 45, max: 45, items: [], note: "" }}
    />,
  );
  assert.doesNotMatch(html, /Режим работы/);
  assert.match(html, /Стоимость/);
}

{
  // Missing price: the hours column takes the full card, no price column.
  const html = renderToStaticMarkup(
    <ArticleInfoCard
      contacts={{ phones: [], socials: [] }}
      openingHours={{ mode: "ALWAYS_OPEN", timezone: "Europe/Minsk", rules: [], exceptions: [] }}
    />,
  );
  assert.match(html, /Режим работы/);
  assert.doesNotMatch(html, /Стоимость/);
  assert.match(html, /Круглосуточно/);
}

{
  // Nothing to show at all: renders nothing, same contract as the individual blocks.
  assert.equal(
    renderToStaticMarkup(
      <ArticleInfoCard
        contacts={{ phones: [], socials: [] }}
        price={{ mode: "NONE", currency: "BYN", min: null, max: null, items: [], note: "" }}
        openingHours={{ mode: "WEEKLY", timezone: "Europe/Minsk", rules: [], exceptions: [] }}
      />,
    ),
    "",
  );
}

console.log("ArticleStructuredInfoBlocks.test.tsx: OK");

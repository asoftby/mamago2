import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventCard } from "@/components/events/EventCard";
import { OfferCard } from "@/components/offers/OfferCard";

const event = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(EventCard, {
  id: "event-a", title: "Название события", href: "/minsk/events/a",
  ...props,
}));
const offer = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(OfferCard, {
  id: "offer-a", title: "Название занятия", href: "/minsk/classes/a", hideSave: true,
  ...props,
}));

test("event and offer use identical canonical meta and price alignment", () => {
  for (const html of [
    event({ metaLabel: "4–8 · 10 ноя.", priceLabel: "10,00 Б" }),
    offer({ dateLabel: "2+", priceLabel: "от 120,00 Б" }),
  ]) {
    assert.match(html, /font-mono text-\[12px\] leading-none/);
    assert.match(html, /inline-flex items-center leading-none/);
    assert.match(html, /Название (события|занятия)/);
    assert.match(html, /data-masonry-media/);
  }
});
test("category formatting and fallback are shared, online is highlighted", () => {
  const evt = event({ categoryLabel: "Занятие · Онлайн", priceLabel: "Бесплатно" });
  const cls = offer({ categoryLabel: "Занятие · Онлайн", priceLabel: "Бесплатно" });
  for (const html of [evt, cls]) {
    assert.match(html, /repeating-linear-gradient/);
    assert.match(html, /animate-ping/);
    assert.match(html, /var\(--success\)/);
    assert.match(html, /Бесплатно/);
  }
});
test("external image fallback retained for both public card kinds", () => {
  const url = "https://example.org/photo.png";
  for (const html of [event({ imageUrl: url }), offer({ imageUrl: url })]) {
    assert.match(html, /<img[^>]+src="https:\/\/example\.org\/photo\.png"/);
    assert.doesNotMatch(html, /\/_next\/image/);
  }
});

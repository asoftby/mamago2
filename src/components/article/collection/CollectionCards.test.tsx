import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { buildEventCardData } from "@/lib/article/collectionEventCard";
import { CollectionNote, CollectionRating, CollectionVenueQuote } from "./CollectionCardParts";

const base = { nextOccurrenceAt: null, ageMinMonths: null, ageMaxMonths: null, priceFrom: null, currency: "BYN", coverImageUrl: null, place: null };

test("event card data: free / paid / unknown price", () => {
  assert.equal(buildEventCardData({ ...base, priceFrom: 0 }).priceLabel, "Бесплатно");
  assert.equal(buildEventCardData({ ...base, priceFrom: 20 }).priceLabel, "от 20 BYN");
  assert.equal(buildEventCardData({ ...base, priceFrom: null }).priceLabel, null);
  assert.equal(buildEventCardData({ ...base, priceFrom: 0 }).isFree, true);
});

test("event card data: free+paid range is not labelled free", () => {
  const d = buildEventCardData({ ...base, priceFrom: 0, priceTo: 15 });
  assert.equal(d.isFree, false);
  assert.equal(d.priceLabel, "до 15 BYN");
});

test("event card data: no age or date leaves empty labels", () => {
  const d = buildEventCardData(base);
  assert.equal(d.ageLabel, null);
  assert.equal(d.dateLabel, "");
});

test("event card data: date is capitalised Russian label", () => {
  const d = buildEventCardData({ ...base, nextOccurrenceAt: new Date("2026-11-15T09:00:00Z") });
  assert.match(d.dateLabel, /^[А-ЯЁ]/);
  assert.match(d.dateLabel, /ноября/);
});

test("rating: no votes shows «Новое на mamaGo», votes show value", () => {
  assert.match(renderToStaticMarkup(<CollectionRating value={null} count={0} />), /Новое на mamaGo/);
  const html = renderToStaticMarkup(<CollectionRating value={4.9} count={38} />);
  assert.match(html, /4,9/);
  assert.match(html, /38 на mamaGo/);
});

test("venue voice is labelled and note is marked «Учтите»", () => {
  assert.match(renderToStaticMarkup(<CollectionVenueQuote text="Свой торт можно" />), /Площадка о себе[\s\S]*«Свой торт можно»/);
  assert.match(renderToStaticMarkup(<CollectionNote text="Только до 18:00" />), /Учтите[\s\S]*Только до 18:00/);
});

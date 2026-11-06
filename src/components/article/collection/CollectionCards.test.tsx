import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { buildEventCardData, eventCardDescription } from "@/lib/article/collectionEventCard";
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

test("event card data: session date and start time in Minsk time", () => {
  const d = buildEventCardData({ ...base, nextOccurrenceAt: new Date("2026-11-15T09:00:00Z") });
  assert.equal(d.dateLabel, "вс, 15 ноя. 2026");
  assert.equal(d.timeLabel, "12:00");
});

test("event card data: category and venue from place with district and metro", () => {
  const d = buildEventCardData({
    ...base,
    eventCategory: { nameRu: "Мастер-классы" },
    place: {
      id: "p1", slug: "izum-club", title: " Izum Club ", customAddress: "Минск, ул. Мястровская, 8", formattedAddr: null,
      districtManual: null, districtAuto: { name: "Центральный р-н" }, metroManual: { name: "Пушкинская" }, metroAuto: { name: "Другая" },
      city: { slug: "minsk" },
    },
  });
  assert.equal(d.categoryLabel, "Мастер-классы");
  assert.equal(d.venue?.name, "Izum Club");
  assert.equal(d.venue?.district, "Центральный р-н");
  assert.equal(d.venue?.metro, "Пушкинская");
  assert.equal(d.venue?.href, "/minsk/places/izum-club");
  assert.match(d.venue?.address ?? "", /Мястровская/);
});

test("event card data: no place means no venue block", () => {
  assert.equal(buildEventCardData(base).venue, null);
  assert.equal(buildEventCardData({ ...base, place: { title: "  " } }).venue, null);
});

test("description: plain text from html, truncated at a word boundary", () => {
  assert.equal(eventCardDescription("<p>Привет, <b>мир</b>!</p>"), "Привет, мир!");
  assert.equal(eventCardDescription("<p> </p>"), null);
  assert.equal(eventCardDescription(null), null);
  const long = eventCardDescription("<p>" + "слово ".repeat(300) + "</p>", 100) ?? "";
  assert.ok(long.length <= 101 && long.endsWith("…"), long);
  assert.doesNotMatch(long, /<|>/);
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

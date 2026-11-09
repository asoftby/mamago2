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

test("event card age uses the same age tags and policy as the event page", () => {
  assert.equal(buildEventCardData({ ...base, ageTags: ["3-5", "5-7"] }).ageLabel, "3–7 лет");
  assert.equal(buildEventCardData({ ...base, ageTags: ["5-7"] }).ageLabel, "5–7 лет");
  assert.equal(buildEventCardData({ ...base, agePolicy: "ADULT_ONLY", ageTags: ["3-5"] }).ageLabel, "18+");
  assert.equal(buildEventCardData({ ...base, agePolicy: "UNRESTRICTED" }).ageLabel, "Любой возраст");
  assert.equal(buildEventCardData({ ...base, ageMinMonths: 36, ageMaxMonths: 60 }).ageLabel, "3–5 лет");
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


test("event venue: explicit PLACE venue overrides a different Activity.place", () => {
  const card = buildEventCardData({
    ...base,
    place: {
      id: "linked", slug: "old-place", title: "Другая площадка",
      customAddress: "Минск, ул. Старая, 1", city: { slug: "minsk" },
    },
    venue: {
      kind: "PLACE", title: null, addressLine: null,
      place: {
        id: "actual", slug: "new-place", title: "Фактическая площадка",
        customAddress: "Минск, ул. Новая, 2",
        districtAuto: { name: "Советский р-н" }, metroAuto: { name: "Немига" },
        city: { slug: "minsk" },
      },
    },
  });
  assert.equal(card.venue?.name, "Фактическая площадка");
  assert.match(card.venue?.address ?? "", /Новая/);
  assert.doesNotMatch(card.venue?.address ?? "", /Старая/);
  assert.equal(card.venue?.href, "/minsk/places/new-place");
  assert.equal(card.venue?.district, "Советский р-н");
});

test("event venue: standalone address overrides linked place without a misleading link", () => {
  const card = buildEventCardData({
    ...base,
    title: "Мастер-класс",
    place: { id: "linked", slug: "incorrect", title: "Место организатора", customAddress: "Минск, ул. Старая, 1" },
    venue: { kind: "CUSTOM", title: "Зал на фестивале", addressLine: "Минск, ул. Новая, 5", place: null },
  });
  assert.equal(card.venue?.name, "Зал на фестивале");
  assert.match(card.venue?.address ?? "", /Новая/);
  assert.equal(card.venue?.href, undefined);
  assert.equal(card.venue?.district, undefined);
  assert.equal(card.venue?.metro, undefined);
});

test("event venue: online activities never show a physical address", () => {
  const card = buildEventCardData({
    ...base, format: "ONLINE",
    place: { title: "Офлайн-площадка", formattedAddr: "Минск, ул. Мира, 3" },
    venue: { kind: "CUSTOM", title: "Другая площадка", addressLine: "Минск, ул. Ленина, 2", place: null },
  });
  assert.equal(card.venue, null);
});

test("event venue: custom title without linked place still renders", () => {
  const card = buildEventCardData({ ...base, title: "Событие", venue: { kind: "CUSTOM", title: "Встреча в парке", addressLine: null, place: null } });
  assert.equal(card.venue?.name, "Встреча в парке");
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

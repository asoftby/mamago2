import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_ARTICLE_PLACE_SECTIONS } from "@/lib/publications/articleMvp";
import {
  ArticleLivePlaceBlock,
  contactsForPlaceSections,
  richPlaceEmbedProps,
} from "./ArticleLivePlaceBlock";
import type { ResolvedArticlePlaceCard } from "@/lib/place/articlePlaceLiveData";
import type { ResolvedPlaceEmbedCard } from "@/lib/place/articlePlaceEmbedData";
import { contactsFromArticlePlace } from "@/lib/place/articlePlaceContacts";

const card: ResolvedArticlePlaceCard = {
  kind: "place-live",
  sections: { ...DEFAULT_ARTICLE_PLACE_SECTIONS },
  place: {
    id: "p1", title: "Музей науки", href: "/minsk/places/museum", imageUrl: "/cover.jpg",
    description: "Короткое описание", address: "Минск, ул. Мира, 1",
    contacts: { address: "Минск, ул. Мира, 1", phones: [{ value: "+375291112233" }], website: "https://example.by", socials: [], mapUrl: "https://maps.google.com/?q=1,2" },
    price: { mode: "FROM", currency: "BYN", min: 15, max: null, items: [], note: "" },
    openingHours: { mode: "ALWAYS_OPEN", timezone: "Europe/Minsk", rules: [], exceptions: [] },
  },
};

{
  const html = renderToStaticMarkup(<ArticleLivePlaceBlock card={card} />);
  for (const value of ["Музей науки", "Короткое описание", "ул. Мира", "+375291112233", "Круглосуточно", "от 15", "Подробнее о месте", "/cover.jpg"]) assert.ok(html.includes(value), `missing ${value}`);
  assert.match(html, /\/minsk\/places\/museum/);
}

{
  const malformedSourceCard = {
    ...card,
    place: {
      ...card.place,
      contacts: contactsFromArticlePlace({
        address: card.place.address,
        phone: "+375291112233",
        website: "not absolute",
        instagramUrl: "also invalid",
        mapUrl: "invalid map",
      }),
    },
  };
  const html = renderToStaticMarkup(<ArticleLivePlaceBlock card={malformedSourceCard} />);
  assert.ok(html.includes("Музей науки"));
  assert.ok(html.includes("+375291112233"));
  assert.ok(!html.includes("not absolute"));
}

{
  const sections = { ...DEFAULT_ARTICLE_PLACE_SECTIONS, image: false, description: false, address: false, contacts: false, openingHours: false, price: false, cta: false };
  const html = renderToStaticMarkup(<ArticleLivePlaceBlock card={{ ...card, sections }} />);
  for (const hidden of ["Короткое описание", "ул. Мира", "+375291112233", "Круглосуточно", "от 15", "Подробнее о месте", "/cover.jpg"]) assert.ok(!html.includes(hidden), `unexpected ${hidden}`);
  assert.deepEqual(contactsForPlaceSections(card.place.contacts, sections), { phones: [], socials: [] });
}

const embedCard = {
  kind: "place-embed",
  placeId: "p1",
  slug: "museum",
  href: "/minsk/places/museum",
  title: "Музей науки",
  categoryLabel: "Музей",
  logoUrl: null,
  coverImageUrl: "/cover.jpg",
  coverImageCount: 4,
  rating: null,
  isOpenNow: true,
  hoursMessage: "Открыто до 20:00",
  metroName: "Площадь Победы",
  districtName: null,
  ageTags: ["3+"],
  address: "Минск, ул. Мира, 1",
  lat: 53.9,
  lng: 27.56,
  mapsUrl: "https://maps.google.com/?q=53.9,27.56",
  updatedAt: "7 сентября 2026 г.",
  tabs: { afisha: [], visit: [], party: [], promo: [] },
  placeExtra: {
    lat: 53.9,
    lng: 27.56,
    address: "Минск, ул. Мира, 1",
    cityName: "Минск",
    openingHoursSummary: "Открыто до 20:00",
    ageTags: ["3+"],
    activityTypes: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    priceData: { items: [], note: "" },
    priceUpdatedAt: new Date("2026-09-01T00:00:00Z"),
  },
} satisfies ResolvedPlaceEmbedCard;

{
  const richCard: ResolvedArticlePlaceCard = {
    ...card,
    place: { ...card.place, embedCard },
  };
  const props = richPlaceEmbedProps(richCard);
  assert.ok(props);
  assert.equal(props.description, "Короткое описание");
  assert.equal(props.contacts?.phones[0]?.value, "+375291112233");
  assert.ok(props.priceLabel?.includes("15"));
  assert.equal(props.showCta, true);
  assert.equal(props.card.coverImageUrl, "/cover.jpg");
  assert.equal(props.card.address, "Минск, ул. Мира, 1");
  assert.equal(props.card.hoursMessage, "Открыто до 20:00");
}

{
  const sections = {
    ...DEFAULT_ARTICLE_PLACE_SECTIONS,
    image: false,
    description: false,
    address: false,
    contacts: false,
    openingHours: false,
    price: false,
    cta: false,
  };
  const props = richPlaceEmbedProps({
    ...card,
    sections,
    place: { ...card.place, embedCard },
  });
  assert.ok(props);
  assert.equal(props.description, null);
  assert.equal(props.contacts, null);
  assert.equal(props.priceLabel, null);
  assert.equal(props.showCta, false);
  assert.equal(props.card.coverImageUrl, null);
  assert.equal(props.card.coverImageCount, 0);
  assert.equal(props.card.address, null);
  assert.equal(props.card.mapsUrl, null);
  assert.equal(props.card.hoursMessage, null);
}

console.log("ArticleLivePlaceBlock.test.tsx: OK");

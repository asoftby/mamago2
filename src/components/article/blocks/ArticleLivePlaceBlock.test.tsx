import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_ARTICLE_PLACE_SECTIONS } from "@/lib/publications/articleMvp";
import { ArticleLivePlaceBlock, contactsForPlaceSections } from "./ArticleLivePlaceBlock";
import type { ResolvedArticlePlaceCard } from "@/lib/place/articlePlaceLiveData";

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
  const sections = { ...DEFAULT_ARTICLE_PLACE_SECTIONS, image: false, description: false, address: false, contacts: false, openingHours: false, price: false, cta: false };
  const html = renderToStaticMarkup(<ArticleLivePlaceBlock card={{ ...card, sections }} />);
  for (const hidden of ["Короткое описание", "ул. Мира", "+375291112233", "Круглосуточно", "от 15", "Подробнее о месте", "/cover.jpg"]) assert.ok(!html.includes(hidden), `unexpected ${hidden}`);
  assert.deepEqual(contactsForPlaceSections(card.place.contacts, sections), { phones: [], socials: [] });
}

console.log("ArticleLivePlaceBlock.test.tsx: OK");

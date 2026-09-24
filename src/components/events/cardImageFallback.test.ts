import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventCard } from "./EventCard";
import { OfferCard } from "@/components/offers/OfferCard";

const externalCover = "https://cdn.some-business.by/cover.webp";

const eventHtml = renderToStaticMarkup(
  createElement(EventCard, {
    id: "event-1",
    title: "External event cover",
    href: "/minsk/events/external",
    imageUrl: externalCover,
    imagePriority: true,
  }),
);
assert.match(eventHtml, /<img[^>]+src="https:\/\/cdn\.some-business\.by\/cover\.webp"/u);
assert.doesNotMatch(eventHtml, /\/_next\/image/u);
assert.match(eventHtml, /loading="eager"/u);
assert.match(eventHtml, /fetchPriority="high"/u);

const offerHtml = renderToStaticMarkup(
  createElement(OfferCard, {
    id: "offer-1",
    title: "External offer cover",
    href: "/minsk/offers/external",
    imageUrl: externalCover,
    hideSave: true,
  }),
);
assert.match(offerHtml, /<img[^>]+src="https:\/\/cdn\.some-business\.by\/cover\.webp"/u);
assert.doesNotMatch(offerHtml, /\/_next\/image/u);
assert.match(offerHtml, /loading="lazy"/u);

const journalSource = readFileSync(
  "src/features/city-home/components/CityHomeContentRows.tsx",
  "utf8",
);
assert.match(
  journalSource,
  /a\.coverImageUrl && canOptimizeWithNextImage\(a\.coverImageUrl\)/u,
);
assert.match(journalSource, /<img[\s\S]+src=\{a\.coverImageUrl\}[\s\S]+loading="lazy"/u);

console.log("card image fallback tests: OK");

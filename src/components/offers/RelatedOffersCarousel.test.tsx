import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { RelatedOffersCarousel } from "./RelatedOffersCarousel";

const source = readFileSync(new URL("./RelatedOffersCarousel.tsx", import.meta.url), "utf8");

test("related offers reuse the homepage carousel, offer cards and sizing", () => {
  assert.match(source, /<HorizontalCardRow/);
  assert.match(source, /<OfferCard/);
  assert.match(source, /EVENT_CARD_SHELL/);
  assert.match(source, /CityHomeAllLink/);
  assert.match(source, /\/classes/);
  assert.match(source, /Другие наши предложения/);
  assert.doesNotMatch(source, /grid-cols-4|<img/);
});

test("no empty related-offer section", () => {
  assert.equal(renderToStaticMarkup(<RelatedOffersCarousel citySlug="minsk" offers={[]} />), "");
});

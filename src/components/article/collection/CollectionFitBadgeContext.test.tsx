import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectionFitBadgeProvider } from "./CollectionFitBadgeContext";
import { CollectionPublicationFrame } from "./CollectionPublicationFrame";

function card() {
  return <CollectionPublicationFrame title="Тест: Мир настольных игр" media={<div>Медиа</div>} identity={<span>Посещение места · 4–12 лет</span>}><div>Стоимость</div></CollectionPublicationFrame>;
}

test("fit label is right aligned within activity identity row", () => {
  const html = renderToStaticMarkup(<CollectionFitBadgeProvider label="Подходит Степану">{card()}</CollectionFitBadgeProvider>);
  assert.match(html, /justify-between/);
  assert.match(html, /Посещение места · 4–12 лет[\s\S]*Подходит Степану[\s\S]*Тест: Мир настольных игр/);
  assert.match(html, /ml-auto/);
  assert.equal((html.match(/Подходит Степану/g) ?? []).length, 1);
});

test("no badge when suitability is not proven", () => {
  const html = renderToStaticMarkup(<CollectionFitBadgeProvider label={null}>{card()}</CollectionFitBadgeProvider>);
  assert.doesNotMatch(html, /Подходит/);
});

test("long family fit label moves to its own right-aligned row", () => {
  const html = renderToStaticMarkup(<CollectionFitBadgeProvider label="Подходит Тае и Степану">{card()}</CollectionFitBadgeProvider>);
  assert.match(html, /basis-full/);
  assert.match(html, /justify-end/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.equal((html.match(/Подходит Тае и Степану/g) ?? []).length, 1);
});

test("short family fit label stays inline when room allows", () => {
  const html = renderToStaticMarkup(<CollectionFitBadgeProvider label="Подходит Степану">{card()}</CollectionFitBadgeProvider>);
  assert.doesNotMatch(html, /basis-full/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { getPublicationPriceParts, PublicationPriceDisplay } from "./PublicationPriceDisplay";

test("public prices display two decimal places without changing their numeric value", () => {
  assert.deepEqual(getPublicationPriceParts("10 BYN"), { prefix: "", amount: "10,00", suffix: BYN_SYMBOL, numeric: true });
  assert.equal(getPublicationPriceParts("от 120,5 BYN").amount, "120,50");
  assert.equal(getPublicationPriceParts("Бесплатно").amount, "Бесплатно");
  assert.equal(getPublicationPriceParts("Цена по запросу").amount, "Цена по запросу");
});

test("canonical event-style price markup is reused by events and offers", () => {
  const html = renderToStaticMarkup(<PublicationPriceDisplay label="10 BYN" />);
  assert.match(html, /Стоимость/);
  assert.match(html, /10,00/);
  assert.match(html, /text-right/);
  assert.match(html, /font-pt-serif/);
});

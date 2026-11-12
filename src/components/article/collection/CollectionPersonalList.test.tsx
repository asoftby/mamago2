import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CollectionPersonalList } from "./CollectionPersonalList";

const items = ["a", "b", "c"].map((id) => ({ id, title: id, ageMinMonths: null, ageMaxMonths: null, node: <p>{`card-${id}`}</p> }));

test("server render keeps editorial order and asks guests for ages", () => {
  const html = renderToStaticMarkup(<CollectionPersonalList items={items} />);
  assert.ok(html.indexOf("card-a") < html.indexOf("card-b") && html.indexOf("card-b") < html.indexOf("card-c"));
  assert.match(html, /Укажите возраст детей/);
  assert.match(html, /Состав подборки не изменится/);
  assert.doesNotMatch(html, /Подходит/);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  CITY_DISPLAY_NAMES,
  CITY_NOMINATIVE,
  getCityDisplayName,
  getCityLocativePhrase,
  getCityNominativeName,
} from "./cityDisplayNames";

const cases = [
  ["minsk", "Минск", "Минске"],
  ["marina-gorka", "Марьина Горка", "Марьиной Горке"],
  ["brest", "Брест", "Бресте"],
  ["gomel", "Гомель", "Гомеле"],
  ["grodno", "Гродно", "Гродно"],
  ["mogilev", "Могилёв", "Могилёве"],
  ["vitebsk", "Витебск", "Витебске"],
  ["borisov", "Борисов", "Борисове"],
  ["molodechno", "Молодечно", "Молодечно"],
  ["soligorsk", "Солигорск", "Солигорске"],
  ["pinsk", "Пинск", "Пинске"],
  ["orsha", "Орша", "Орше"],
  ["lida", "Лида", "Лиде"],
] as const;

test("known Belarus city slugs have nominative and prepositional Russian forms", () => {
  for (const [slug, nominative, prepositional] of cases) {
    assert.equal(CITY_NOMINATIVE[slug], nominative);
    assert.equal(CITY_DISPLAY_NAMES[slug], prepositional);
    assert.equal(getCityNominativeName(slug), nominative);
    assert.equal(getCityDisplayName(slug), prepositional);
    assert.equal(getCityLocativePhrase(slug), `в ${prepositional}`);
  }
});

test("Minsk metadata phrasing uses the locative form", () => {
  assert.equal(getCityDisplayName("minsk"), "Минске");
  assert.equal(getCityLocativePhrase("minsk"), "в Минске");
});

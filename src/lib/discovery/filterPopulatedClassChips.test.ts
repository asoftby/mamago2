import assert from "node:assert/strict";
import test from "node:test";
import { filterPopulatedClassChips } from "./filterPopulatedClassChips";

const chips = [
  { slug: "all", isActive: true, title: "Все" },
  { slug: "clubs", isActive: true, title: "Кружки" },
  { slug: "sport", isActive: true, title: "Спорт" },
  { slug: "dance", isActive: false, title: "Танцы" },
  { slug: "music", isActive: true, title: "Музыка" },
];

test("empty public Classes catalog renders no category chips, including All", () => {
  assert.deepEqual(filterPopulatedClassChips(chips, false, new Set(["sport"])), []);
});

test("only active categories with public offers are rendered, preserving order", () => {
  assert.deepEqual(
    filterPopulatedClassChips(chips, true, new Set(["sport", "dance"])).map((chip) => chip.slug),
    ["all", "sport"],
  );
});

test("offers without class chips keep the All category visible", () => {
  assert.deepEqual(
    filterPopulatedClassChips(chips, true, new Set()).map((chip) => chip.slug),
    ["all"],
  );
});

test("chips become visible once a public offer is assigned to them", () => {
  assert.deepEqual(
    filterPopulatedClassChips(chips, true, new Set(["clubs", "music"])).map((chip) => chip.slug),
    ["all", "clubs", "music"],
  );
});

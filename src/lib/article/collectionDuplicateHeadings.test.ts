import assert from "node:assert/strict";
import test from "node:test";
import { collectionDuplicateHeadingIds } from "./collectionDuplicateHeadings";
import type { ArticleMvpResolvedBlock } from "./articleMvpRenderData";

const h = (id: string, text: string) => ({ type: "heading", id, level: 3, text });
const event = (title: string) => ({ type: "activityCard", id: `card-${title}`, entityId: "event1", entityType: "EVENT", card: { kind: "basic", title, href: "/minsk/events/one" } });
const check = (blocks: unknown[]) => collectionDuplicateHeadingIds(blocks as ArticleMvpResolvedBlock[]);

test("removes numbered duplicate immediately before resolved card", () => {
  assert.deepEqual([...check([h("duplicate", "3. Тест: Первые звуки и музыка"), event("Тест: Первые звуки и музыка")])], ["duplicate"]);
});
test("preserves editorial headings, nonadjacent headings and missing cards", () => {
  assert.deepEqual([...check([h("editorial", "Почему стоит сходить"), event("Детский спектакль")])], []);
  assert.deepEqual([...check([h("distant", "1. Детский спектакль"), {type:"text",text:"Описание",id:"text"}, event("Детский спектакль")])], []);
  assert.deepEqual([...check([h("unresolved", "1. Детский спектакль"), { ...event("Детский спектакль"), card: null }])], []);
});

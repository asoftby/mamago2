import assert from "node:assert/strict";
import test from "node:test";
import type { ArticleMvpResolvedBlock } from "./articleMvpRenderData";
import { collectionContiguousCardRuns } from "./collectionCardRuns";

const card = (id: string, entityId: string) =>
  ({ id, type: "activityCard", entityType: "EVENT", entityId, card: { title: id } }) as unknown as ArticleMvpResolvedBlock;
const heading = (id: string) =>
  ({ id, type: "heading", level: 2, text: id }) as ArticleMvpResolvedBlock;

test("editorial headings and descriptions partition card runs", () => {
  const blocks = [
    heading("indoor"), card("a", "1"), card("b", "2"),
    heading("outdoor"), card("c", "3"),
    { id: "description", type: "text", text: "Editorial explanation" } as ArticleMvpResolvedBlock,
    card("d", "4"),
  ];
  assert.deepEqual(collectionContiguousCardRuns(blocks).map((run) => run.map((block) => block.id)), [
    ["a", "b"], ["c"], ["d"],
  ]);
});

test("duplicate linked card is omitted without moving other cards across headings", () => {
  const blocks = [card("a", "1"), card("a-duplicate", "1"), heading("second"), card("b", "2")];
  assert.deepEqual(collectionContiguousCardRuns(blocks).map((run) => run.map((block) => block.id)), [["a"], ["b"]]);
});

test("missing cards do not join surrounding editorial groups", () => {
  const missing = { ...card("missing", "3"), card: null } as ArticleMvpResolvedBlock;
  assert.deepEqual(collectionContiguousCardRuns([card("a", "1"), missing, card("b", "2")]).map((run) => run.map((block) => block.id)), [["a"], ["b"]]);
});

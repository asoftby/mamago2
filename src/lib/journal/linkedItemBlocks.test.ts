import assert from "node:assert/strict";
import test from "node:test";
import { linkedItemsToCardBlocks } from "./linkedItemBlocks";

test("linked items keep saved order by position and map kinds to entity types", () => {
  const blocks = linkedItemsToCardBlocks([
    { id: "c", kind: "ARTICLE", position: 2, activityId: null, offerId: null, linkedArticleId: "a1" },
    { id: "a", kind: "EVENT", position: 0, activityId: "e1", offerId: null, linkedArticleId: null },
    { id: "b", kind: "OFFER", position: 1, activityId: null, offerId: "o1", linkedArticleId: null },
  ]);
  assert.deepEqual(
    blocks.map((b) => [b.entityType, b.entityId]),
    [["EVENT", "e1"], ["OFFER", "o1"], ["ARTICLE", "a1"]],
  );
  assert.ok(blocks.every((b) => b.type === "activityCard"));
});

test("linked items without a target id are skipped", () => {
  assert.deepEqual(
    linkedItemsToCardBlocks([
      { id: "x", kind: "EVENT", position: 0, activityId: null, offerId: null, linkedArticleId: null },
    ]),
    [],
  );
});

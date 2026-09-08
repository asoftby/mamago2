import assert from "node:assert/strict";
import { groupArticleInfoBlocks } from "./articleInfoBlockGrouping";

type Block = { id: string; type: string };

{
  // Adjacent contacts/price/openingHours merge into one info group.
  const blocks: Block[] = [
    { id: "a", type: "text" },
    { id: "b", type: "contacts" },
    { id: "c", type: "price" },
    { id: "d", type: "openingHours" },
    { id: "e", type: "text" },
  ];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].kind, "single");
  assert.equal(groups[1].kind, "info");
  assert.equal(groups[1].kind === "info" && groups[1].blocks.map((b) => b.id).join(","), "b,c,d");
  assert.equal(groups[1].index, 1);
  assert.equal(groups[2].kind, "single");
  assert.equal(groups[2].kind === "single" && groups[2].block.id, "e");
}

{
  // A lone info-type block (nothing adjacent of the same family) still forms
  // its own one-item info group — it always renders as ArticleInfoCard, never
  // the old standalone Shell layout.
  const blocks: Block[] = [{ id: "a", type: "contacts" }];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, "info");
  assert.equal(groups[0].kind === "info" && groups[0].blocks.length, 1);
}

{
  // Two separate runs, split by an unrelated block, stay two distinct groups.
  const blocks: Block[] = [
    { id: "a", type: "contacts" },
    { id: "b", type: "price" },
    { id: "c", type: "heading" },
    { id: "d", type: "openingHours" },
    { id: "e", type: "contacts" },
  ];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].kind, "info");
  assert.equal(groups[1].kind, "single");
  assert.equal(groups[2].kind, "info");
  assert.equal(groups[2].index, 3);
}

{
  // No info blocks at all: everything passes through untouched.
  const blocks: Block[] = [{ id: "a", type: "text" }, { id: "b", type: "heading" }];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 2);
  assert.ok(groups.every((g) => g.kind === "single"));
}

{
  // A repeated type within a run must not be swallowed: the run stops
  // before it repeats, and the second occurrence starts its own group so
  // nothing silently disappears (each block still ends up in some group).
  const blocks: Block[] = [
    { id: "a", type: "contacts" },
    { id: "b", type: "price" },
    { id: "c", type: "contacts" },
  ];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].kind, "info");
  assert.equal(groups[0].kind === "info" && groups[0].blocks.map((b) => b.id).join(","), "a,b");
  assert.equal(groups[1].kind, "info");
  assert.equal(groups[1].kind === "info" && groups[1].blocks.map((b) => b.id).join(","), "c");
}

console.log("articleInfoBlockGrouping.test.ts: OK");

import assert from "node:assert/strict";
import { groupArticleInfoBlocks } from "./articleInfoBlockGrouping";

type Block = { id: string; type: string; subject?: { id: string } };

{
  // Legacy adjacent structured blocks without a subject keep the old compact grouping.
  const blocks: Block[] = [
    { id: "a", type: "text" },
    { id: "b", type: "contacts" },
    { id: "c", type: "price" },
    { id: "d", type: "openingHours" },
    { id: "e", type: "text" },
  ];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 3);
  assert.equal(groups[1].kind, "info");
  assert.equal(groups[1].kind === "info" && groups[1].blocks.map((b) => b.id).join(","), "b,c,d");
  assert.equal(groups[1].index, 1);
}

{
  // New structured blocks for the same subject merge into one card.
  const subject = { id: "studio-kids" };
  const blocks: Block[] = [
    { id: "contacts", type: "contacts", subject },
    { id: "price", type: "price", subject },
    { id: "hours", type: "openingHours", subject },
  ];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, "info");
  assert.equal(groups[0].kind === "info" && groups[0].blocks.length, 3);
}

{
  // Adjacent blocks belonging to different described objects must never merge.
  const blocks: Block[] = [
    { id: "a", type: "contacts", subject: { id: "studio-a" } },
    { id: "b", type: "price", subject: { id: "studio-b" } },
  ];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 2);
  assert.ok(groups.every((group) => group.kind === "info"));
  assert.equal(groups[0].kind === "info" && groups[0].blocks[0]?.id, "a");
  assert.equal(groups[1].kind === "info" && groups[1].blocks[0]?.id, "b");
}

{
  // A bound block cannot be silently merged with an old unbound block.
  const blocks: Block[] = [
    { id: "a", type: "contacts", subject: { id: "studio-a" } },
    { id: "b", type: "price" },
  ];
  assert.equal(groupArticleInfoBlocks(blocks).length, 2);
}

{
  const blocks: Block[] = [{ id: "a", type: "contacts" }];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, "info");
}

{
  const blocks: Block[] = [
    { id: "a", type: "contacts" },
    { id: "b", type: "price" },
    { id: "c", type: "heading" },
    { id: "d", type: "openingHours" },
    { id: "e", type: "contacts" },
  ];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 3);
  assert.equal(groups[2].index, 3);
}

{
  const blocks: Block[] = [{ id: "a", type: "text" }, { id: "b", type: "heading" }];
  assert.ok(groupArticleInfoBlocks(blocks).every((g) => g.kind === "single"));
}

{
  const blocks: Block[] = [
    { id: "a", type: "contacts" },
    { id: "b", type: "price" },
    { id: "c", type: "contacts" },
  ];
  const groups = groupArticleInfoBlocks(blocks);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].kind === "info" && groups[0].blocks.map((b) => b.id).join(","), "a,b");
  assert.equal(groups[1].kind === "info" && groups[1].blocks[0]?.id, "c");
}

console.log("articleInfoBlockGrouping.test.ts: OK");

import assert from "node:assert/strict";
import {
  ArticleContentPayloadSchema,
  normalizeLegacyArticleInfoBlocks,
  prepareArticleContentForSave,
  type ArticleBlockMvp,
} from "./articleMvp";

const subject = (id: string) => ({ id, source: "MANUAL" as const, title: id });
const weekly = { mode: "WEEKLY" as const, timezone: "Europe/Minsk", rules: [], exceptions: [] };

function info(data: Extract<ArticleBlockMvp, { type: "info" }>["data"]): ArticleBlockMvp {
  return { id: "info", type: "info", subject: subject("venue"), data };
}

{
  const one = info({ locations: [{ id: "one", address: "Минск", coordinates: { latitude: 53.9, longitude: 27.5 } }], phones: [], socials: [] });
  const two = info({ locations: [{ id: "one", coordinates: { latitude: 53.9, longitude: 27.5 } }, { id: "two", coordinates: { latitude: 52, longitude: 28 } }], phones: [], socials: [] });
  assert.equal(ArticleContentPayloadSchema.safeParse({ version: 1, blocks: [one] }).success, true);
  assert.equal(ArticleContentPayloadSchema.safeParse({ version: 1, blocks: [two] }).success, true);
  assert.notDeepEqual(two.type === "info" && two.data.locations[0]?.coordinates, two.type === "info" && two.data.locations[1]?.coordinates);
  assert.equal(ArticleContentPayloadSchema.safeParse({ version: 1, blocks: [info({ locations: [], phones: [], socials: [], price: { mode: "FREE", currency: "BYN", min: 0, max: 0, items: [], note: "" } })] }).success, true);
  assert.equal(ArticleContentPayloadSchema.safeParse({ version: 1, blocks: [info({ locations: [], phones: [], socials: [], openingHours: weekly })] }).success, true);
  assert.equal(ArticleContentPayloadSchema.safeParse({ version: 1, blocks: [info({ locations: [], phones: [], socials: [] })] }).success, true);
  assert.equal(ArticleContentPayloadSchema.safeParse({ version: 1, blocks: [info({ locations: [{ id: "bad", coordinates: { latitude: 91, longitude: 27 } }], phones: [], socials: [] })] }).success, false);
  assert.equal(ArticleContentPayloadSchema.safeParse({ version: 1, blocks: [info({ locations: [], phones: [], socials: [], email: "bad" })] }).success, false);
  assert.equal(ArticleContentPayloadSchema.safeParse({ version: 1, blocks: [info({ locations: [], phones: [], socials: [], website: "bad" })] }).success, false);
}

{
  const blocks: ArticleBlockMvp[] = [
    { id: "before", type: "text", text: "before" },
    { id: "contacts", type: "contacts", subject: subject("a"), data: { address: "Address", coordinates: { latitude: 53, longitude: 27 }, phones: [], socials: [] } },
    { id: "price", type: "price", subject: subject("a"), data: { mode: "FREE", currency: "BYN", min: 0, max: 0, items: [], note: "" } },
    { id: "hours", type: "openingHours", subject: subject("a"), data: weekly },
    { id: "after", type: "text", text: "after" },
  ];
  const normalized = normalizeLegacyArticleInfoBlocks(blocks);
  assert.deepEqual(normalized.map((block) => block.type), ["text", "info", "text"]);
  const normalizedInfo = normalized[1];
  assert.equal(normalizedInfo.type === "info" ? normalizedInfo.data.locations[0]?.address : null, "Address");
  assert.deepEqual(normalizedInfo.type === "info" ? normalizedInfo.data.locations[0]?.coordinates : null, { latitude: 53, longitude: 27 });
  const saved = prepareArticleContentForSave({ version: 1, blocks: normalized });
  assert.equal(saved.blocks[1]?.type, "info");

  const different = normalizeLegacyArticleInfoBlocks([
    { id: "c", type: "contacts", subject: subject("a"), data: { phones: [], socials: [] } },
    { id: "p", type: "price", subject: subject("b"), data: { mode: "FREE", currency: "BYN", min: 0, max: 0, items: [], note: "" } },
  ]);
  assert.equal(different.length, 2);
  assert.ok(different.every((block) => block.type === "info"));
}

{
  const prepared = prepareArticleContentForSave({ version: 1, blocks: [info({
    locations: [{ id: "blank", label: "ignored" }, { id: "kept", label: " Branch ", address: " Address " }, { id: "coords", coordinates: { latitude: 53, longitude: 27 } }],
    phones: [{ value: " " }, { value: " +375291112233 " }],
    socials: [{ kind: "instagram", url: " " }],
  })] });
  const block = prepared.blocks[0];
  assert.ok(block.type === "info");
  if (block.type === "info") {
    assert.deepEqual(block.data.locations.map((location) => location.id), ["kept", "coords"]);
    assert.equal(block.data.locations[0]?.label, "Branch");
    assert.equal(block.data.locations[0]?.address, "Address");
    assert.deepEqual(block.data.phones, [{ value: "+375291112233" }]);
    assert.deepEqual(block.data.socials, []);
  }
}

console.log("articleInfoBlock.test.ts: OK");

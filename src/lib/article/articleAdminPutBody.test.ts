import assert from "node:assert/strict";
import { ArticleAdminPutBodySchema, articleSaveInputFromPutBody } from "./articleAdminPutBody";

const base = {
  title: "Test",
  slug: null,
  content: { version: 1 as const, blocks: [] },
  coverImageId: null,
  status: "DRAFT" as const,
  publishedAt: null,
  scheduledAt: null,
  noindex: false,
};

const omitted = articleSaveInputFromPutBody(ArticleAdminPutBodySchema.parse(base));
assert.equal(omitted.additionalGeographyTargets, undefined);
assert.equal(omitted.additionalCategoryIds, undefined);

const empty = articleSaveInputFromPutBody(ArticleAdminPutBodySchema.parse({
  ...base,
  additionalGeographyTargets: [],
  additionalCategoryIds: [],
}));
assert.deepEqual(empty.additionalGeographyTargets, []);
assert.deepEqual(empty.additionalCategoryIds, []);

console.log("articleAdminPutBody.test.ts: OK");

const structured = ArticleAdminPutBodySchema.parse({
  ...base,
  content: {
    version: 1,
    blocks: [
      { id: "contacts", type: "contacts", data: { address: "Минск", phones: [], socials: [] } },
      { id: "price", type: "price", data: { mode: "FREE", currency: "BYN", min: 0, max: 0, items: [], note: "" } },
      { id: "hours", type: "openingHours", data: { mode: "ALWAYS_OPEN", timezone: "Europe/Minsk", rules: [], exceptions: [] } },
    ],
  },
});
assert.deepEqual(articleSaveInputFromPutBody(structured).content, structured.content, "structured snapshots remain part of the single Article critical write");

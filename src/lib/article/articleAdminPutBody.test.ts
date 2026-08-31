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

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const page = readFileSync("src/server/journal/journalPage.ts", "utf8");
const listing = readFileSync("src/server/article/listCityHomeArticles.ts", "utf8");
const api = readFileSync("src/lib/article/articleAdminPutBody.ts", "utf8");
const service = readFileSync("src/lib/article/articleAdminService.ts", "utf8");
const editor = readFileSync("src/components/admin/articles/ArticleEditorClient.tsx", "utf8");

test("journal news skips occasion reads and seasonal geography bucket splitting", () => {
  assert.match(page, /input\.typeFilter === "BREAKING_NEWS" \? null : await getSeasonallyCurrentJournalWhere\(\)/);
  assert.match(page, /additionalWhere: base\.news, seasonalPriority: false/);
  assert.match(page, /additionalWhere: newsFeedWhere, seasonalPriority: false/);
});

test("journal feed reuses the already loaded seasonal filter", () => {
  assert.match(page, /seasonalWhere: current \?\? undefined/);
  assert.match(listing, /options\.seasonalWhere \?\? await getSeasonallyCurrentJournalWhere\(\)/);
});

test("season review is bound to the exact window presented to the editor", () => {
  assert.match(editor, /seasonReviewStartsAt: occasions\.find/);
  assert.match(api, /seasonReviewStartsAt: z\.string\(\)\.datetime/);
  assert.match(service, /new Date\(input\.seasonReviewStartsAt\)\.getTime\(\) !== occasion\.startsAt\.getTime\(\)/);
});

/**
 * Run: pnpm exec tsx src/lib/publications/breakingNewsLocalDraft.test.ts
 */
import assert from "node:assert/strict";

import type { BreakingNewsFormState } from "./breakingNewsArticle";
import {
  BREAKING_NEWS_DRAFT_KEY_NEW,
  breakingNewsDraftKeyEdit,
  breakingNewsEditorComparable,
  buildBreakingNewsLocalDraft,
  getBreakingNewsDraftStorageKey,
  isBreakingNewsLocalDraftEmpty,
} from "./breakingNewsLocalDraft";

function baseFormState(): BreakingNewsFormState {
  return {
    title: "",
    slug: "",
    coverImageId: "",
    galleryIds: [],
    bodyHtml: "",
    pricingHtml: "",
    linkedEntityType: "PLACE",
    linkedEntityId: "",
    status: "DRAFT",
    scheduledAtLocal: "",
    publishedAtLocal: "",
    seoTitle: "",
    seoDescription: "",
    seoCanonicalUrl: "",
    noindex: false,
    authorUserId: "user-1",
    geoScope: "CITY",
    cityId: "minsk-id",
  };
}

assert.equal(getBreakingNewsDraftStorageKey(null), BREAKING_NEWS_DRAFT_KEY_NEW);
assert.equal(getBreakingNewsDraftStorageKey(undefined), BREAKING_NEWS_DRAFT_KEY_NEW);
assert.equal(
  getBreakingNewsDraftStorageKey("abc-123"),
  breakingNewsDraftKeyEdit("abc-123"),
);

assert.equal(isBreakingNewsLocalDraftEmpty(baseFormState()), true, "author/geo defaults alone are empty");

assert.equal(
  isBreakingNewsLocalDraftEmpty({ ...baseFormState(), title: "Заголовок" }),
  false,
);

assert.equal(
  isBreakingNewsLocalDraftEmpty({ ...baseFormState(), pricingHtml: "25,00 Br" }),
  false,
);

const baselineComparable = breakingNewsEditorComparable({
  ...baseFormState(),
  coverImagePreviewUrl: "",
});

const draftWithCost = buildBreakingNewsLocalDraft(
  { ...baseFormState(), pricingHtml: "25,00 Br", linkedEntityId: "place-1" },
  "",
);

assert.notEqual(
  breakingNewsEditorComparable(draftWithCost),
  baselineComparable,
  "manual cost changes comparable",
);

const draftWithPlaceOnly = buildBreakingNewsLocalDraft(
  { ...baseFormState(), linkedEntityId: "place-1" },
  "",
);

assert.notEqual(
  breakingNewsEditorComparable(draftWithPlaceOnly),
  breakingNewsEditorComparable({
    ...baseFormState(),
    pricingHtml: "25,00 Br",
    linkedEntityId: "place-1",
    coverImagePreviewUrl: "",
  }),
  "place selection must not imply cost text in comparable",
);

console.log("✅ breakingNewsLocalDraft.test.ts — all assertions passed");

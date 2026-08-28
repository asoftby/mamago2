/**
 * SEO-safe slug flow — scope, uniqueness, history warnings.
 * Run: pnpm exec tsx src/lib/slug/slugFlow.test.ts
 */
import assert from "node:assert/strict";
import {
  articlePublicSlugHistoryWhere,
  articlePublicSlugWhere,
  articleSlugScopeWhere,
  articlesShareSlugScope,
  shouldRecordArticleSlugHistory,
} from "./articleSlugService";
import { ensureUniqueSlug } from "./ensureUniqueSlug";
import {
  SLUG_CHANGE_REDIRECT_WARNING,
  SLUG_CHANGE_URL_WARNING,
  slugChangeWarningMessage,
  slugChangeWarningMessageForKind,
} from "./slugHistorySupport";

// ── article slug scope (matches Prisma unique on cityId + slug) ───────────────

assert.deepEqual(articleSlugScopeWhere("my-slug", "city-a"), {
  slug: "my-slug",
  cityId: "city-a",
});
assert.deepEqual(articleSlugScopeWhere("my-slug", null), {
  slug: "my-slug",
  cityId: null,
});

assert.equal(articlesShareSlugScope("city-a", "city-a"), true);
assert.equal(articlesShareSlugScope("city-a", "city-b"), false);
assert.equal(articlesShareSlugScope(null, null), true);
assert.equal(articlesShareSlugScope(null, "city-a"), false);

// same slug in different city scopes → independent keys
assert.notEqual(
  articleSlugScopeWhere("weekend", "minsk").cityId,
  articleSlugScopeWhere("weekend", "brest").cityId,
);

// ── public article lookup must never resolve unpublished content ─────────────

assert.deepEqual(articlePublicSlugWhere("weekend", null), {
  slug: "weekend",
  cityId: null,
  status: "PUBLISHED",
});
assert.deepEqual(articlePublicSlugWhere("weekend", "minsk"), {
  slug: "weekend",
  cityId: "minsk",
  status: "PUBLISHED",
});
assert.deepEqual(articlePublicSlugHistoryWhere("old-weekend", null), {
  slug: "old-weekend",
  cityId: null,
  article: {
    status: "PUBLISHED",
  },
});

// ── duplicate slug in same scope → -2 suffix ──────────────────────────────────

async function runAsyncTests() {
  const takenInMinsk = new Set(["weekend"]);
  assert.equal(
    await ensureUniqueSlug({
      base: "weekend",
      isAvailable: async (s) => !takenInMinsk.has(s),
    }),
    "weekend-2",
  );

  const takenNational = new Set(["national-obzor"]);
  assert.equal(
    await ensureUniqueSlug({
      base: "national-obzor",
      isAvailable: async (s) => !takenNational.has(s),
    }),
    "national-obzor-2",
  );

  const minskSlugs = new Set(["shared-title"]);
  const brestSlugs = new Set<string>();
  assert.equal(
    await ensureUniqueSlug({
      base: "shared-title",
      isAvailable: async (s) => !minskSlugs.has(s),
    }),
    "shared-title-2",
  );
  assert.equal(
    await ensureUniqueSlug({
      base: "shared-title",
      isAvailable: async (s) => !brestSlugs.has(s),
    }),
    "shared-title",
  );
}

// ── published article slug change → ArticleSlugHistory ──────────────────────

assert.equal(shouldRecordArticleSlugHistory("old-slug", "new-slug"), true);
assert.equal(shouldRecordArticleSlugHistory("same", "same"), false);
assert.equal(shouldRecordArticleSlugHistory(null, "new-slug"), false);
assert.equal(shouldRecordArticleSlugHistory("", "new-slug"), false);

// ── SEO editor warnings ───────────────────────────────────────────────────────

assert.equal(
  slugChangeWarningMessageForKind("article"),
  SLUG_CHANGE_REDIRECT_WARNING,
);
assert.equal(
  slugChangeWarningMessageForKind("place"),
  SLUG_CHANGE_REDIRECT_WARNING,
);

assert.equal(slugChangeWarningMessage(true), SLUG_CHANGE_REDIRECT_WARNING);
assert.equal(slugChangeWarningMessage(false), SLUG_CHANGE_URL_WARNING);
assert.ok(
  !slugChangeWarningMessage(false).includes("редирект"),
  "entities without history must not promise redirect",
);

runAsyncTests().then(() => {
  console.log("✅ slugFlow.test.ts — all assertions passed");
});

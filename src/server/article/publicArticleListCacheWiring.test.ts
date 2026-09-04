/**
 * Static wiring checks for the public article-list cache. The cache itself is a
 * Next runtime concern; these checks protect key composition and mutation
 * invalidation without requiring an incremental-cache request context.
 *
 * Run: npx tsx src/server/article/publicArticleListCacheWiring.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const listSource = readFileSync("src/server/article/listCityHomeArticles.ts", "utf8");
const cacheSource = readFileSync("src/server/article/publicArticleCache.ts", "utf8");
const createRoute = readFileSync("src/app/api/admin/articles/route.ts", "utf8");
const updateRoute = readFileSync("src/app/api/admin/articles/[id]/route.ts", "utf8");
const archiveRoute = readFileSync("src/app/api/admin/articles/[id]/archive/route.ts", "utf8");
const categoryRoute = readFileSync(
  "src/app/api/admin/taxonomy/event-categories/[id]/route.ts",
  "utf8",
);
const discoveryTagRoute = readFileSync(
  "src/app/api/admin/discovery-tags/[id]/route.ts",
  "utf8",
);
const articleDetailData = readFileSync("src/lib/article/articleMvpRenderData.ts", "utf8");

assert.match(listSource, /unstable_cache/);
assert.match(
  listSource,
  /\["public-article-list:city", city\.id, city\.slug, city\.regionId \?\? ""\]/,
  "city cache key must include every geography dimension that shapes membership or hrefs",
);
assert.match(listSource, /\["public-article-list:national"\]/);
assert.match(listSource, /PUBLIC_ARTICLE_LIST_CACHE_TAG/);
assert.match(listSource, /PUBLIC_ARTICLE_CATEGORY_DEPENDENCY_TAG/);
assert.match(listSource, /PUBLIC_ARTICLE_LIST_REVALIDATE_SECONDS/);
assert.match(cacheSource, /PUBLIC_ARTICLE_LIST_REVALIDATE_SECONDS = 60 \* 60/);
assert.match(
  cacheSource,
  /PUBLIC_ARTICLE_CATEGORY_DEPENDENCY_TAG = "event-step1-categories"/,
  "article lists must subscribe to the category mutation tag used by taxonomy admin routes",
);
assert.match(
  categoryRoute,
  /revalidateTag\(EVENT_STEP1_CATEGORIES_TAG, "max"\)/,
  "category mutation route must keep invalidating the shared category dependency tag",
);

assert.match(
  createRoute,
  /snapshot\.status === "PUBLISHED"[\s\S]*invalidatePublicArticleLists\(\)/,
  "published create must invalidate public article lists",
);
assert.match(
  updateRoute,
  /await saveArticleDraft\(id, input\)[\s\S]*invalidatePublicArticleLists\(\)/,
  "article save must invalidate because it can publish/unpublish/move/change list fields",
);
assert.match(
  archiveRoute,
  /data: \{ status: "ARCHIVED" \}[\s\S]*invalidatePublicArticleLists\(\)/,
  "archive must evict the article from cached public lists immediately",
);
const tagInvalidations = discoveryTagRoute.match(/invalidatePublicArticleLists\(\)/g) ?? [];
assert.ok(
  tagInvalidations.length >= 2,
  "discovery tag PATCH and DELETE must invalidate cached list-facing tag labels",
);

assert.doesNotMatch(
  articleDetailData,
  /publicArticleCache/,
  "article detail is intentionally outside this cache slice until embedded Event/Offer/Place dependencies are modeled",
);

console.log("public article list cache wiring tests: OK");

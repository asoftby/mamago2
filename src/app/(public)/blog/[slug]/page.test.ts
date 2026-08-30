/**
 * Regression test for a race-condition leak on /blog/[slug] (national
 * REGION/COUNTRY article route).
 *
 * The page does TWO canonical-visibility reads for the same article, both
 * built from the shared `getPublicPublishedArticleWhere()` predicate:
 *   1. `loadArticleMvpBySlugPublic(slug, null)` — loads the renderable MVP.
 *   2. `getArticleSchemaData(mvp.id)` (page-local) — a second, independent
 *      visibility read used for JSON-LD/canonical metadata.
 *
 * If the article stops being publicly visible (unpublished/archived) in the
 * window between these two reads, the second read correctly returns `null`
 * — but the page used to keep rendering the already-loaded `mvp` content
 * anyway (via `schemaArticle?.field` optional chaining), instead of 404ing.
 * That meant a request racing an unpublish/archive action could still see
 * full content + SEO/JSON-LD for a publication that is, by the time the
 * response is built, no longer publicly published.
 *
 * Part 1 proves the race precondition against the real local dev DB, using
 * the shared `getPublicPublishedArticleWhere()` predicate directly — the
 * exact same predicate both `loadArticleMvpBySlugPublic` and the page's
 * `getArticleSchemaData` build their `where` clause from: a lookup succeeds
 * while the article is PUBLISHED, then the article is flipped to ARCHIVED
 * to simulate a concurrent unpublish racing the request, and the same
 * lookup genuinely returns null afterwards. (Neither `./page` nor
 * `articleMvpRenderData` can be imported here — both transitively pull in
 * `server-only`-guarded modules, e.g. via Offer/Place card resolution, which
 * unconditionally throw outside Next's own RSC bundler.)
 *
 * Part 2 proves the page's control flow reacts to that null correctly. The
 * page module itself can't be imported from a plain script for the same
 * `server-only` reason, and separately `getCurrentUser()` needs a real
 * Next.js request scope (same class of constraint already documented in
 * src/app/api/save/status/route.test.ts) — so this is a static wiring
 * assertion on the source, not a live import/render.
 *
 * Запуск: set -a; source .env; set +a; npx tsx "src/app/(public)/blog/[slug]/page.test.ts"
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import prisma from "@/lib/prisma";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";

async function testSecondReadReturnsNullAfterRaceUnpublish() {
  const slug = `race-test-article-${Date.now()}`;
  const article = await prisma.article.create({
    data: {
      title: "Race condition regression test article",
      slug,
      cityId: null,
      geoScope: "COUNTRY",
      status: "PUBLISHED",
      publishedAt: new Date(),
      contentJson: {
        version: 1,
        blocks: [{ id: "b1", type: "text", text: "Regression test paragraph." }],
      },
    },
    select: { id: true },
  });

  const publicLookup = (id: string) =>
    prisma.article.findFirst({
      where: { id, ...getPublicPublishedArticleWhere() },
      select: { id: true },
    });

  try {
    // Step 1: first canonical-visibility read succeeds — article is public.
    const firstRead = await publicLookup(article.id);
    assert.ok(firstRead, "expected the first read to find the freshly published article");

    // Step 2: publication becomes invisible in the window between reads —
    // simulates a concurrent unpublish/archive racing this request.
    await prisma.article.update({
      where: { id: article.id },
      data: { status: "ARCHIVED" },
    });

    // Step 3: a second read against the same shared visibility predicate
    // (`getPublicPublishedArticleWhere()`, used identically by
    // `loadArticleMvpBySlugPublic` and the page's `getArticleSchemaData`)
    // must now genuinely return nothing.
    const secondRead = await publicLookup(article.id);
    assert.equal(secondRead, null, "expected the second read to see the article as no longer public");
  } finally {
    await prisma.article.delete({ where: { id: article.id } });
    // The search-index extension re-indexes on delete via fire-and-forget,
    // which can race this script's exit — clean up explicitly, same as
    // src/server/services/publicationIndexingRace.test.ts does.
    await prisma.searchDocument.deleteMany({
      where: { entityType: "article", entityId: article.id },
    });
  }
}

function testPageCallsNotFoundWhenSecondReadIsNull() {
  const source = readFileSync("src/app/(public)/blog/[slug]/page.tsx", "utf8");

  const callSite = source.indexOf("const schemaArticle = await getArticleSchemaData(mvp.id);");
  assert.notEqual(callSite, -1, "expected the second visibility read call site to still exist");

  // The next ~200 chars after the call must contain the notFound() guard,
  // before any JSON-LD/content is built from mvp/schemaArticle.
  const guardWindow = source.slice(callSite, callSite + 200);
  assert.match(
    guardWindow,
    /if\s*\(\s*!schemaArticle\s*\)\s*\{\s*notFound\(\);\s*\}/,
    "expected `if (!schemaArticle) { notFound(); }` immediately after the second visibility read — " +
      "without it, a race that unpublishes the article between the two reads still renders the " +
      "already-loaded content instead of 404ing",
  );

  const jsonLdBuildIndex = source.indexOf("buildArticleJsonLd(", callSite);
  const guardIndex = callSite + guardWindow.indexOf("notFound();");
  assert.ok(
    jsonLdBuildIndex === -1 || guardIndex < jsonLdBuildIndex,
    "the notFound() guard must run before JSON-LD is built from the (possibly stale) mvp/schemaArticle data",
  );
}

async function main() {
  await testSecondReadReturnsNullAfterRaceUnpublish();
  testPageCallsNotFoundWhenSecondReadIsNull();
  console.log("blog/[slug] visibility race regression: OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

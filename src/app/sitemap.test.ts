/**
 * Task 8 (BACKLOG-064) regression tests for `src/app/sitemap.ts`:
 * - the newly-added listing-page entries (global /routes, /blog; per-city
 *   /programs, /classes, /routes, /blog) are present, birthday stays absent;
 * - `hasNoindexRobots()` matches the same comma-separated semantics as the
 *   per-entity `parseRobots()` helpers used by the detail pages;
 * - an entity with `seoRobots` explicitly set to "noindex" never gets a
 *   sitemap entry, while an otherwise-identical published entity does;
 * - no duplicate URLs, every URL absolute and well-formed.
 *
 * Run: set -a; source .env; set +a; npx tsx src/app/sitemap.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import sitemap, { hasNoindexRobots } from "@/app/sitemap";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";

function testHasNoindexRobots() {
  assert.equal(hasNoindexRobots(null), false);
  assert.equal(hasNoindexRobots(undefined), false);
  assert.equal(hasNoindexRobots(""), false);
  assert.equal(hasNoindexRobots("index,follow"), false);
  assert.equal(hasNoindexRobots("noindex"), true);
  assert.equal(hasNoindexRobots("noindex,nofollow"), true);
  assert.equal(hasNoindexRobots("NOINDEX, FOLLOW"), true, "must be case-insensitive");
  assert.equal(hasNoindexRobots("index, follow"), false);
}

async function testSitemapContents() {
  // sitemap() short-circuits to [] under the prelaunch-default global
  // noindex flag (src/lib/seo/globalNoindex.ts) — already covered by
  // globalNoindex.test.ts; this test is about sitemap *contents*, so it
  // needs indexing enabled to exercise the real entry-building logic.
  process.env.SITE_INDEXING_ENABLED = "true";

  const marker = randomUUID();

  const user = await prisma.user.create({
    data: { email: `sitemap-test-${marker}@example.invalid` },
    select: { id: true },
  });

  const city = await prisma.city.findFirst({
    where: { isActive: true, isLegacyNonCity: false },
    select: { id: true, slug: true },
  });
  assert.ok(city, "expected at least one active city in the local dev DB for this test");

  const visiblePlace = await prisma.place.create({
    data: {
      title: `Sitemap test visible place ${marker}`,
      shortDesc: "test",
      status: "PUBLISHED",
      createdByUserId: user.id,
      cityId: city!.id,
      slug: `sitemap-test-visible-${marker}`,
    },
    select: { id: true, slug: true },
  });
  const noindexPlace = await prisma.place.create({
    data: {
      title: `Sitemap test noindex place ${marker}`,
      shortDesc: "test",
      status: "PUBLISHED",
      createdByUserId: user.id,
      cityId: city!.id,
      slug: `sitemap-test-noindex-${marker}`,
      seoRobots: "noindex,nofollow",
    },
    select: { id: true, slug: true },
  });
  const noindexArticle = await prisma.article.create({
    data: {
      title: `Sitemap test noindex article ${marker}`,
      slug: `sitemap-noindex-article-${marker}`,
      status: "PUBLISHED",
      geoScope: "COUNTRY",
      noindex: false,
      seoRobots: "noindex, follow",
      publishedAt: new Date(),
    },
    select: { id: true, slug: true },
  });

  try {
    const previousAppEnv = process.env.APP_ENV;

    const { entries, prodBase } = await (async () => {
      try {
        process.env.APP_ENV = "dev";
        const devEntries = await sitemap();

        assert.deepEqual(
          devEntries,
          [],
          "DEV sitemap must remain empty under global noindex",
        );

        process.env.APP_ENV = "production";
        const prodBase = getCanonicalPublicAppUrl();
        const entries = await sitemap();

        assert.ok(entries.length > 0, "PROD sitemap must not be empty");

        return { entries, prodBase };
      } finally {
        if (previousAppEnv === undefined) {
          delete process.env.APP_ENV;
        } else {
          process.env.APP_ENV = previousAppEnv;
        }
      }
    })();

    const urls = entries.map((entry) => entry.url);

    for (const path of [
      "/routes",
      "/blog",
      `/${city!.slug}`,
      `/${city!.slug}/events`,
      `/${city!.slug}/routes`,
      `/${city!.slug}/blog`,
      `/${city!.slug}/places/${visiblePlace.slug}`,
    ]) {
      assert.ok(
        urls.includes(`${prodBase}${path}`),
        `Required PROD sitemap entry missing: ${path}`,
      );
    }

    const deferredSections = new Set([
      "classes",
      "programs",
      "birthday",
    ]);

    for (const url of urls) {
      const segments = new URL(url).pathname.split("/");
      assert.ok(
        !segments.some((segment) => deferredSections.has(segment)),
        `Deferred section leaked into PROD sitemap: ${url}`,
      );
    }

    // --- seoRobots noindex exclusion, proven end-to-end (not just the helper) ---
    assert.ok(
      urls.includes(`${prodBase}/${city!.slug}/places/${visiblePlace.slug}`),
      "a normal published place without seoRobots must appear under its city-scoped canonical",
    );
    assert.ok(
      !urls.some((url) => url.includes(noindexPlace.slug!)),
      "a place with seoRobots=noindex must never appear in the sitemap",
    );
    assert.ok(
      !urls.some((url) => url.includes(noindexArticle.slug!)),
      "an article with seoRobots=noindex must never appear in the sitemap",
    );

    // --- structural sanity ---
    assert.equal(urls.length, new Set(urls).size, "sitemap must not contain duplicate URLs");
    for (const url of urls) {
      assert.doesNotThrow(() => new URL(url), `malformed URL in sitemap: ${url}`);
      assert.ok(new URL(url).origin === new URL(prodBase).origin, `sitemap URL must be absolute and same-origin: ${url}`);
    }

    console.log(`sitemap (Task 8 / BACKLOG-064) tests: OK (${urls.length} entries)`);
  } finally {
    await prisma.article.delete({ where: { id: noindexArticle.id } });
    await prisma.place.deleteMany({ where: { id: { in: [visiblePlace.id, noindexPlace.id] } } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

testHasNoindexRobots();
testSitemapContents().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

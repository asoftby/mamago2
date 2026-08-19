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
  const base = getCanonicalPublicAppUrl();

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

  try {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    // --- global listing entries ---
    assert.ok(urls.includes(`${base}/routes`), "sitemap must include the global /routes listing");
    assert.ok(urls.includes(`${base}/blog`), "sitemap must include the global /blog listing");

    // --- per-city listing entries (BACKLOG-064 approved gaps only) ---
    assert.ok(
      urls.includes(`${base}/${city!.slug}/programs`),
      "sitemap must include /{city}/programs",
    );
    assert.ok(
      urls.includes(`${base}/${city!.slug}/classes`),
      "sitemap must include /{city}/classes",
    );
    assert.ok(
      urls.includes(`${base}/${city!.slug}/routes`),
      "sitemap must include /{city}/routes",
    );
    assert.ok(
      urls.includes(`${base}/${city!.slug}/blog`),
      "sitemap must include /{city}/blog",
    );
    assert.ok(
      !urls.includes(`${base}/${city!.slug}/birthday`),
      "sitemap must NOT include /{city}/birthday — not part of the approved BACKLOG-064 gap list",
    );

    // --- seoRobots noindex exclusion, proven end-to-end (not just the helper) ---
    assert.ok(
      urls.includes(`${base}/places/${visiblePlace.slug}`),
      "a normal published place without seoRobots must appear in the sitemap",
    );
    assert.ok(
      !urls.some((url) => url.includes(noindexPlace.slug!)),
      "a place with seoRobots=noindex must never appear in the sitemap",
    );

    // --- structural sanity ---
    assert.equal(urls.length, new Set(urls).size, "sitemap must not contain duplicate URLs");
    for (const url of urls) {
      assert.doesNotThrow(() => new URL(url), `malformed URL in sitemap: ${url}`);
      assert.ok(url.startsWith(base), `sitemap URL must be absolute and same-origin: ${url}`);
    }

    console.log(`sitemap (Task 8 / BACKLOG-064) tests: OK (${urls.length} entries)`);
  } finally {
    await prisma.place.deleteMany({ where: { id: { in: [visiblePlace.id, noindexPlace.id] } } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

testHasNoindexRobots();
testSitemapContents().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

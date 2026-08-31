/**
 * Repair PLAN/APPLY/idempotency/precondition-failure coverage for
 * migratedArticlePublicationGeoRepair.ts, using scratch Article rows (not
 * the real hard-coded production IDs) against the local DB.
 * Run: set -a; source .env; set +a; pnpm exec tsx src/lib/seo/migratedArticlePublicationGeoRepair.test.ts
 */
import assert from "node:assert/strict";
import { prismaBase as prisma, searchIndexer } from "@/lib/prisma";
import type { MigratedArticlePublicationGeoRecovery } from "./migratedArticlePublicationGeoRecovery";
import {
  applyPublicationGeoPlan,
  buildPublicationGeoPlan,
  resolveMinskCity,
} from "./migratedArticlePublicationGeoRepair";
import { getPublicPublishedArticleWhere } from "@/server/public/publicContentVisibility";
import { DEFAULT_COUNTRY_ISO } from "@/server/geo/geoConstants";

/**
 * Resolves the Minsk city through the exact same helper the repair script
 * calls (resolveMinskCity), rather than a hand-copied WHERE clause — so
 * this test suite exercises production behavior directly and cannot drift
 * from it.
 */
async function getMinskCity() {
  const city = await resolveMinskCity(prisma);
  assert.ok(city, "expected active Belarus Minsk city in local DB");
  return city;
}

async function getOtherCity(excludeCityId: string) {
  const city = await prisma.city.findFirst({
    where: { isActive: true, id: { not: excludeCityId } },
    select: { id: true, slug: true },
  });
  return city;
}

async function createPendingArticle(opts: {
  slug: string;
  cityId?: string | null;
  geoScope?: "CITY" | "COUNTRY" | null;
  status?: "PENDING" | "PUBLISHED";
}) {
  return prisma.article.create({
    data: {
      title: `Publication geo repair test ${opts.slug}`,
      slug: opts.slug,
      status: opts.status ?? "PENDING",
      geoScope: opts.geoScope ?? null,
      cityId: opts.cityId ?? null,
      publishedAt: new Date("2024-06-01T00:00:00Z"),
      contentJson: {
        version: 1,
        blocks: [{ id: "b1", type: "text", text: "Regression fixture paragraph." }],
      },
    },
    select: { id: true, title: true, contentJson: true, publishedAt: true, slug: true, updatedAt: true },
  });
}

async function getArticleFull(id: string) {
  return prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      status: true,
      geoScope: true,
      cityId: true,
      title: true,
      updatedAt: true,
      publishedAt: true,
      noindex: true,
      seoRobots: true,
      contentJson: true,
    },
  });
}

async function cleanup(articleId: string) {
  await prisma.searchDocument.deleteMany({
    where: { entityType: "article", entityId: articleId },
  });
  await prisma.article.deleteMany({ where: { id: articleId } });
}

async function assertSingleValidSearchDocument(
  articleId: string,
  expectedTitle: string,
  expectedUrlPath: string,
) {
  const docs = await prisma.searchDocument.findMany({
    where: { entityType: "article", entityId: articleId },
  });
  assert.equal(docs.length, 1, "expected exactly one article SearchDocument");
  assert.equal(docs[0].isPublished, true);
  assert.equal(docs[0].title, expectedTitle);
  assert.equal(docs[0].urlPath, expectedUrlPath);
}

function makeRecovery(
  fixture: { id: string; title: string; slug: string | null },
  geoScope: "CITY" | "COUNTRY",
  opts?: {
    overrideTitle?: string;
    overrideUpdatedAt?: string;
    overridePublishedAt?: string;
    overrideNoindex?: boolean;
    overrideBlocksCount?: number;
    citySlug?: "minsk" | null;
  },
): MigratedArticlePublicationGeoRecovery {
  return {
    articleId: fixture.id,
    title: fixture.title,
    auditedTitle: opts?.overrideTitle ?? fixture.title,
    currentSlug: fixture.slug ?? "missing-slug",
    legacyUrl: `/${fixture.slug ?? "missing-slug"}-legacy`,
    geoScope,
    citySlug: geoScope === "CITY" ? "minsk" : null,
    confidence: "HIGH",
    reason: "test fixture",
    expectedUpdatedAt: opts?.overrideUpdatedAt ?? new Date().toISOString(),
    auditedPublishedAt: opts?.overridePublishedAt ?? "2024-06-01T00:00:00.000Z",
    auditedNoindex: opts?.overrideNoindex ?? false,
    auditedSeoRobots: null,
    auditedBlocksCount: opts?.overrideBlocksCount ?? 1,
  };
}

async function testCityRecoveryApply() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-city-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery = makeRecovery(fixture, "CITY");
    // Set expectedUpdatedAt to the actual updatedAt we just created
    const full = await getArticleFull(fixture.id);
    recovery.expectedUpdatedAt = full!.updatedAt!.toISOString();

    const before = await prisma.article.findFirst({
      where: { ...getPublicPublishedArticleWhere(), id: fixture.id },
      select: { id: true },
    });
    assert.equal(before, null, "PENDING article must not be publicly visible before repair");

    // PLAN #1 — should classify as "apply"
    const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].action, "apply");
    assert.equal(plan[0].finalCanonicalPath, `/minsk/blog/${slug}`);

    // APPLY #1
    const result = await applyPublicationGeoPlan(prisma, plan, searchIndexer);
    assert.equal(result.applied, 1);
    assert.equal(result.reindexed, 1);
    await assertSingleValidSearchDocument(fixture.id, fixture.title, `/minsk/blog/${slug}`);

    const after = await getArticleFull(fixture.id);
    assert.equal(after?.status, "PUBLISHED");
    assert.equal(after?.geoScope, "CITY");
    assert.equal(after?.cityId, minsk.id);
    // Fields the repair MUST NOT touch stay byte-identical.
    assert.equal(after?.slug, fixture.slug);
    assert.equal(after?.title, fixture.title);
    assert.deepEqual(after?.contentJson, fixture.contentJson);
    assert.equal(after?.publishedAt?.toISOString(), fixture.publishedAt?.toISOString());

    const nowPublic = await prisma.article.findFirst({
      where: { ...getPublicPublishedArticleWhere(), id: fixture.id },
      select: { id: true },
    });
    assert.ok(nowPublic, "PUBLISHED article must be publicly visible after repair");

    // PLAN #2 using the SAME original recovery (NOT mutating expectedUpdatedAt).
    // After APPLY, updatedAt has advanced. The fixed order checks already_applied
    // FIRST (by publication state), exempting updatedAt drift. This must pass
    // without touching recovery.expectedUpdatedAt.
    const plan2 = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(
      plan2[0].action,
      "already_applied",
      `idempotent rerun must be already_applied, got ${plan2[0].action} (reason: ${plan2[0].reason ?? "none"})`,
    );

    // APPLY #2 using the SAME original recovery — no-op.
    const result2 = await applyPublicationGeoPlan(prisma, plan2, searchIndexer);
    assert.equal(result2.applied, 0);
    assert.equal(result2.reindexed, 1, "already_applied rerun must still reindex");
    await assertSingleValidSearchDocument(fixture.id, fixture.title, `/minsk/blog/${slug}`);
  } finally {
    await cleanup(fixture.id);
  }
}

async function testCountryRecoveryApply() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-country-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery = makeRecovery(fixture, "COUNTRY");
    const full = await getArticleFull(fixture.id);
    recovery.expectedUpdatedAt = full!.updatedAt!.toISOString();

    const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan[0].action, "apply");
    assert.equal(plan[0].finalCanonicalPath, `/blog/${slug}`);

    const result = await applyPublicationGeoPlan(prisma, plan, searchIndexer);
    assert.equal(result.applied, 1);
    assert.equal(result.reindexed, 1);
    await assertSingleValidSearchDocument(fixture.id, fixture.title, `/blog/${slug}`);

    const after = await getArticleFull(fixture.id);
    assert.equal(after?.status, "PUBLISHED");
    assert.equal(after?.geoScope, "COUNTRY");
    assert.equal(after?.cityId, null);
  } finally {
    await cleanup(fixture.id);
  }
}

async function testWrongCityConflictFailsClosed() {
  const minsk = await getMinskCity();
  const otherCity = await getOtherCity(minsk.id);
  if (!otherCity) {
    console.log("skip: no secondary active city for wrong-city conflict test");
    return;
  }

  const suffix = Date.now().toString(36);
  const slug = `pub-geo-wrongcity-${suffix}`;
  // Precondition violated: cityId already set to a city other than NULL.
  const fixture = await createPendingArticle({ slug, cityId: otherCity.id, geoScope: "CITY" });

  try {
    const recovery = makeRecovery(fixture, "CITY");
    const full = await getArticleFull(fixture.id);
    recovery.expectedUpdatedAt = full!.updatedAt!.toISOString();

    const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan[0].action, "conflict");

    await assert.rejects(() => applyPublicationGeoPlan(prisma, plan, searchIndexer));

    const after = await getArticleFull(fixture.id);
    assert.equal(after?.status, "PENDING", "conflict row must not be written");
    assert.equal(after?.cityId, otherCity.id, "conflict row must not be written");
  } finally {
    await cleanup(fixture.id);
  }
}

/**
 * PLAN and APPLY are separate round-trips. If an article's state drifts in
 * between (another process/editor writes to it after PLAN read it but
 * before APPLY runs), APPLY must not blindly trust the stale PLAN snapshot
 * and overwrite whatever is there now. It must re-check the precondition
 * atomically at write time and, if it no longer holds, abort the *entire*
 * transaction — including any row in the same APPLY call that was still
 * genuinely valid.
 */
async function testRaceDriftBetweenPlanAndApplyRollsBackWholeTransaction() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const validSlug = `pub-geo-race-valid-${suffix}`;
  const driftSlug = `pub-geo-race-drift-${suffix}`;

  const validFixture = await createPendingArticle({ slug: validSlug });
  const driftFixture = await createPendingArticle({ slug: driftSlug });

  try {
    const validRecovery = makeRecovery(validFixture, "CITY");
    const driftRecovery = makeRecovery(driftFixture, "CITY");

    // Set expectedUpdatedAt to actual timestamps
    const validFull = await getArticleFull(validFixture.id);
    const driftFull = await getArticleFull(driftFixture.id);
    validRecovery.expectedUpdatedAt = validFull!.updatedAt!.toISOString();
    driftRecovery.expectedUpdatedAt = driftFull!.updatedAt!.toISOString();

    // PLAN observes both rows as clean PENDING/null/null -> both "apply".
    const plan = await buildPublicationGeoPlan(prisma, [validRecovery, driftRecovery], minsk.id);
    assert.equal(plan[0].action, "apply");
    assert.equal(plan[1].action, "apply");

    // Simulate external drift on driftFixture AFTER PLAN was built, before APPLY runs.
    await prisma.article.update({
      where: { id: driftFixture.id },
      data: { status: "NEEDS_REVISION" },
    });

    // validRecovery is ordered first so its write would commit inside the
    // transaction before driftRecovery's atomic precondition check fails —
    // proving the rollback undoes an already-applied sibling write too.
    await assert.rejects(() => applyPublicationGeoPlan(prisma, plan, searchIndexer));

    const validAfter = await getArticleFull(validFixture.id);
    assert.equal(
      validAfter?.status,
      "PENDING",
      "sibling row in the same transaction must be rolled back, not partially applied",
    );
    assert.equal(validAfter?.geoScope, null);
    assert.equal(validAfter?.cityId, null);

    const driftAfter = await getArticleFull(driftFixture.id);
    assert.equal(driftAfter?.status, "NEEDS_REVISION", "drifted row must remain untouched by repair");
  } finally {
    await cleanup(validFixture.id);
    await cleanup(driftFixture.id);
  }
}

/** Same TOCTOU scenario, but the drift is a slug change rather than a status change. */
async function testSlugDriftBetweenPlanAndApplyFailsClosed() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-slugdrift-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery = makeRecovery(fixture, "CITY");
    const full = await getArticleFull(fixture.id);
    recovery.expectedUpdatedAt = full!.updatedAt!.toISOString();

    const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan[0].action, "apply");

    // Simulate a manual SEO-editor slug change between PLAN and APPLY.
    const driftedSlug = `${slug}-edited`;
    await prisma.article.update({ where: { id: fixture.id }, data: { slug: driftedSlug } });

    await assert.rejects(() => applyPublicationGeoPlan(prisma, plan, searchIndexer));

    const after = await getArticleFull(fixture.id);
    assert.equal(after?.status, "PENDING", "slug-drifted row must not be published");
    assert.equal(after?.slug, driftedSlug, "repair must never touch slug");
  } finally {
    await cleanup(fixture.id);
  }
}

async function testMissingArticleFailsClosed() {
  const minsk = await getMinskCity();
  const recovery: MigratedArticlePublicationGeoRecovery = {
    articleId: `missing-pub-geo-${Date.now().toString(36)}`,
    title: "Missing article",
    auditedTitle: "Missing article",
    currentSlug: "missing-pub-geo-slug",
    legacyUrl: "/missing-pub-geo-slug-legacy",
    geoScope: "CITY",
    citySlug: "minsk",
    confidence: "HIGH",
    reason: "test fixture",
    expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
    auditedPublishedAt: "2024-01-01T00:00:00.000Z",
    auditedNoindex: false,
    auditedSeoRobots: null,
    auditedBlocksCount: 1,
  };

  const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
  assert.equal(plan[0].action, "not_found");
  await assert.rejects(() => applyPublicationGeoPlan(prisma, plan, searchIndexer));
}

/**
 * Regression: if the article's content/title/SEO fields are edited after the
 * PROD audit (while staying PENDING/null/null), updatedAt advances via
 * @updatedAt, so the audited-state guard must reject the row and PLAN must
 * report conflict.
 *
 * This prevents the one-recovery TOCTOU gap: the original atomic guard only
 * checked id/slug/PENDING/null/null, which would still match after a
 * content-only edit. Adding updatedAt === expectedUpdatedAt to both PLAN
 * validation and the updateMany WHERE clause closes this gap.
 */
async function testContentEditAfterAuditFailsClosed() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-contentdrift-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery = makeRecovery(fixture, "CITY");

    // Capture the updatedAt from just after creation (simulates "audit time")
    const initialFull = await getArticleFull(fixture.id);
    recovery.expectedUpdatedAt = initialFull!.updatedAt!.toISOString();
    recovery.auditedTitle = fixture.title;
    recovery.auditedPublishedAt = "2024-06-01T00:00:00.000Z";
    recovery.auditedNoindex = false;
    recovery.auditedBlocksCount = 1;

    // PLAN at this point should see "apply" — everything matches.
    const plan1 = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan1[0].action, "apply");

    // Now simulate a "post-audit edit": change title while keeping PENDING/null/null.
    // This advances updatedAt via @updatedAt, invalidating the audited-state guard.
    const newTitle = `EDITED AFTER AUDIT ${suffix}`;
    await prisma.article.update({
      where: { id: fixture.id },
      data: { title: newTitle },
    });

    // Re-check: PLAN should now report conflict due to updatedAt drift (and title drift).
    const plan2 = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(
      plan2[0].action,
      "conflict",
      "post-audit content edit must be detected as conflict",
    );
    assert.ok(
      plan2[0].reason?.includes("audited state drift"),
      `conflict reason must mention audited state drift: ${plan2[0].reason}`,
    );

    // APPLY must refuse and never touch the row.
    await assert.rejects(() => applyPublicationGeoPlan(prisma, plan2, searchIndexer));

    const after = await getArticleFull(fixture.id);
    assert.equal(after?.status, "PENDING", "content-drifted row must not be published");
    assert.equal(after?.title, newTitle, "title must retain the post-audit value");
    assert.equal(after?.geoScope, null, "geoScope must remain unchanged");
    assert.equal(after?.cityId, null, "cityId must remain unchanged");
  } finally {
    await cleanup(fixture.id);
  }
}

/**
 * Regression: content edit after PLAN but before APPLY must also fail.
 * The updateMany WHERE clause includes updatedAt=expectedUpdatedAt, so even
 * if PLAN was built before the edit, the APPLY write will fail because the
 * @updatedAt timestamp no longer matches.
 */
async function testContentDriftBetweenPlanAndApplyFailsClosed() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-race-content-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery = makeRecovery(fixture, "CITY");
    const initialFull = await getArticleFull(fixture.id);
    recovery.expectedUpdatedAt = initialFull!.updatedAt!.toISOString();
    recovery.auditedTitle = fixture.title;
    recovery.auditedPublishedAt = "2024-06-01T00:00:00.000Z";
    recovery.auditedNoindex = false;
    recovery.auditedBlocksCount = 1;

    // PLAN — looks good
    const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan[0].action, "apply");

    // Edit content AFTER PLAN, before APPLY (changes updatedAt)
    await prisma.article.update({
      where: { id: fixture.id },
      data: { title: `post-plan-edit-${suffix}` },
    });

    // APPLY should fail because updatedAt no longer matches
    await assert.rejects(() => applyPublicationGeoPlan(prisma, plan, searchIndexer));

    const after = await getArticleFull(fixture.id);
    assert.equal(after?.status, "PENDING", "content-drifted row must not be published");
    assert.equal(after?.geoScope, null, "geoScope must remain unchanged");
    assert.equal(after?.cityId, null, "cityId must remain unchanged");
  } finally {
    await cleanup(fixture.id);
  }
}

/**
 * Regression: the Minsk city lookup must be scoped to Belarus
 * (DEFAULT_COUNTRY_ISO="BY"). Create a "minsk" city in a non-Belarus
 * country and verify that the helper function does not pick it up.
 *
 * This test directly queries the Prisma model with the same WHERE clause
 * the repair script uses. If only one valid Minsk exists (in Belarus), the
 * filtered result returns just the Belarus one. Without the country filter,
 * a foreign "minsk" would cause ambiguity.
 *
 * We validate by:
 * 1. Creating a temporary City row in another country with slug "minsk"
 * 2. Querying with the repair script's WHERE clause
 * 3. Confirming only the Belarus Minsk is returned
 * 4. Cleaning up the foreign row
 */
async function testBelarusScopedMinskLookup() {
  // First, get the current Belarus Minsk city ID.
  const minsk = await getMinskCity();
  assert.ok(minsk, "Belarus Minsk city must exist");

  // Find or create a non-Belarus country to host a foreign "minsk"
  let foreignCountry = await prisma.country.findFirst({
    where: { isoCode: { not: DEFAULT_COUNTRY_ISO } },
    select: { id: true, isoCode: true },
  });

  let createdCountry = false;
  if (!foreignCountry) {
    // Create a temporary test country
    foreignCountry = await prisma.country.create({
      data: {
        isoCode: "ZZ",
        name: "Fake Test Country",
        slug: "fake-test-country",
        isActive: false,
        priority: 0,
      },
      select: { id: true, isoCode: true },
    });
    createdCountry = true;
  }

  // Create a temporary "minsk" city in the non-Belarus country
  const foreignMinsk = await prisma.city.create({
    data: {
      slug: "minsk",
      name: "Minsk (foreign)",
      countryId: foreignCountry!.id,
      isActive: true,
      isLegacyNonCity: false,
    },
    select: { id: true },
  });

  try {
    // Call the actual production helper — must still resolve to exactly the Belarus Minsk.
    const belarusMinsk = await resolveMinskCity(prisma);
    assert.ok(belarusMinsk, "Belarus Minsk must still be resolvable");
    assert.equal(belarusMinsk!.id, minsk.id, "must resolve to the Belarus Minsk");

    // Without the country filter, there are now two "minsk" cities
    const allMinsk = await prisma.city.findMany({
      where: { slug: "minsk", isActive: true, isLegacyNonCity: false },
      select: { id: true },
    });
    assert.ok(
      allMinsk.length >= 2,
      `with foreign minsk, must find at least 2 minsk cities, got ${allMinsk.length}`,
    );

    // Confirm the Belarus-scoped lookup returns the right one
    const count = await prisma.city.count({
      where: {
        slug: "minsk",
        isActive: true,
        isLegacyNonCity: false,
        country: { isoCode: DEFAULT_COUNTRY_ISO },
      },
    });
    assert.equal(count, 1, "exactly one active Belarus Minsk must exist");

    // Also verify that findFirst without country filter would NOT be deterministic
    // (if we had >=2 cities, findFirst picks the first matching, which DB ordering might
    //  make ambiguous)
  } finally {
    // Cleanup: remove the foreign minsk city first
    await prisma.city.deleteMany({ where: { id: foreignMinsk.id } });
    // Cleanup: remove the temporary country if we created it
    if (createdCountry && foreignCountry) {
      await prisma.country.deleteMany({ where: { id: foreignCountry.id } });
    }
  }
}

/**
 * Regression: after a successful APPLY, an unrelated editor edit (e.g. title
 * change) must be detected by the already_applied branch's post-repair checks.
 * The row is PUBLISHED with correct geoScope/cityId, so it hits the
 * already_applied branch first. But since title (or noindex, or blocksCount)
 * drifted from the audited fingerprint, it must be classified as conflict
 * rather than already_applied. This proves we only exempt repair-induced
 * updatedAt drift, not real later content changes.
 */
async function testPostRepairContentDriftFailsClosed() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-postdrift-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery = makeRecovery(fixture, "CITY");
    const full = await getArticleFull(fixture.id);
    recovery.expectedUpdatedAt = full!.updatedAt!.toISOString();
    recovery.auditedTitle = fixture.title;
    recovery.auditedPublishedAt = "2024-06-01T00:00:00.000Z";
    recovery.auditedNoindex = false;
    recovery.auditedBlocksCount = 1;

    // PLAN #1 → apply
    const plan1 = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan1[0].action, "apply");

    // APPLY #1 — success
    await applyPublicationGeoPlan(prisma, plan1, searchIndexer);
    let after = await getArticleFull(fixture.id);
    assert.equal(after?.status, "PUBLISHED");

    // Simulate post-repair content drift: change title and noindex
    await prisma.article.update({
      where: { id: fixture.id },
      data: {
        title: `EDITED AFTER REPAIR ${suffix}`,
        noindex: true,
      },
    });

    // PLAN #2 with the SAME original recovery — must detect drift
    const plan2 = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(
      plan2[0].action,
      "conflict",
      `post-repair content edit must be detected as conflict, got ${plan2[0].action} (reason: ${plan2[0].reason ?? "none"})`,
    );
    assert.ok(
      plan2[0].reason?.includes("post-repair drift"),
      `reason must mention post-repair drift: ${plan2[0].reason}`,
    );

    // APPLY must refuse
    await assert.rejects(() => applyPublicationGeoPlan(prisma, plan2, searchIndexer));

    // Verify the row was NOT reverted by repair attempt
    after = await getArticleFull(fixture.id);
    assert.equal(after?.status, "PUBLISHED", "already-published row must stay published");
    assert.equal(
      after?.title,
      `EDITED AFTER REPAIR ${suffix}`,
      "post-repair title edit must be preserved",
    );
    assert.equal(after?.noindex, true, "post-repair noindex edit must be preserved");
  } finally {
    await cleanup(fixture.id);
  }
}

/** Strict indexing is awaited after commit and verified before returning. */
async function testApplyReindexesArticleForSearch() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-reindex-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery = makeRecovery(fixture, "CITY");
    const full = await getArticleFull(fixture.id);
    recovery.expectedUpdatedAt = full!.updatedAt!.toISOString();

    const plan = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan[0].action, "apply");

    const docBefore = await prisma.searchDocument.findUnique({
      where: { entityType_entityId: { entityType: "article", entityId: fixture.id } },
    });
    assert.equal(docBefore, null, "no search document should exist before APPLY");

    await applyPublicationGeoPlan(prisma, plan, searchIndexer);

    await assertSingleValidSearchDocument(fixture.id, fixture.title, `/minsk/blog/${slug}`);
  } finally {
    await cleanup(fixture.id);
  }
}

/**
 * Run #1 commits publication and then fails strict indexing. Run #2 sees
 * already_applied, performs zero publication writes, and repairs search.
 */
async function testPostCommitIndexFailureIsResumable() {
  const minsk = await getMinskCity();
  const suffix = Date.now().toString(36);
  const slug = `pub-geo-index-retry-${suffix}`;
  const fixture = await createPendingArticle({ slug });

  try {
    const recovery = makeRecovery(fixture, "CITY");
    const full = await getArticleFull(fixture.id);
    recovery.expectedUpdatedAt = full!.updatedAt!.toISOString();

    const plan1 = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan1[0].action, "apply");

    const failingIndexer = {
      async upsertArticleStrict(articleId: string): Promise<void> {
        assert.equal(articleId, fixture.id);
        throw new Error("injected strict article indexing failure");
      },
    };
    await assert.rejects(
      () => applyPublicationGeoPlan(prisma, plan1, failingIndexer),
      /injected strict article indexing failure/,
    );

    const afterFailure = await getArticleFull(fixture.id);
    assert.equal(afterFailure?.status, "PUBLISHED", "publication commit must survive index failure");
    assert.equal(afterFailure?.geoScope, "CITY");
    assert.equal(afterFailure?.cityId, minsk.id);
    assert.equal(
      await prisma.searchDocument.count({
        where: { entityType: "article", entityId: fixture.id },
      }),
      0,
      "failed strict index must not create a document",
    );

    const plan2 = await buildPublicationGeoPlan(prisma, [recovery], minsk.id);
    assert.equal(plan2[0].action, "already_applied");
    const result2 = await applyPublicationGeoPlan(prisma, plan2, searchIndexer);
    assert.equal(result2.applied, 0, "retry must perform zero publication writes");
    assert.equal(result2.reindexed, 1, "retry must still perform strict reindex");
    await assertSingleValidSearchDocument(fixture.id, fixture.title, `/minsk/blog/${slug}`);
  } finally {
    await cleanup(fixture.id);
  }
}

async function main() {
  await testCityRecoveryApply();
  await testCountryRecoveryApply();
  await testWrongCityConflictFailsClosed();
  await testRaceDriftBetweenPlanAndApplyRollsBackWholeTransaction();
  await testSlugDriftBetweenPlanAndApplyFailsClosed();
  await testMissingArticleFailsClosed();
  await testContentEditAfterAuditFailsClosed();
  await testContentDriftBetweenPlanAndApplyFailsClosed();
  await testBelarusScopedMinskLookup();
  await testPostRepairContentDriftFailsClosed();
  await testApplyReindexesArticleForSearch();
  await testPostCommitIndexFailureIsResumable();
  console.log("migratedArticlePublicationGeoRepair.test.ts: PASS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
